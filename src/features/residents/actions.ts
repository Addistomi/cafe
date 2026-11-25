'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getProfile, requireRole, MANAGERS } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FormState } from '@/features/auth/actions';

const applicationSchema = z.object({
  legal_name: z.string().trim().min(2, 'Enter your full legal name').max(120),
  date_of_birth: z.string().refine((value) => {
    const date = new Date(value + 'T00:00:00');
    return value.length > 0 && !Number.isNaN(date.getTime()) && date <= new Date();
  }, 'Enter a valid date of birth'),
  nationality: z.string().trim().min(2, 'Enter your nationality').max(80),
  resident_type: z.enum(['OWNER', 'TENANT', 'FAMILY_MEMBER', 'EMPLOYEE']),
  id_document_type: z.enum(['FAYDA', 'KEBELE_ID', 'PASSPORT', 'DRIVER_LICENSE', 'OTHER']),
  id_document_last4: z.string().trim().regex(/^[A-Za-z0-9]{2,4}$/, 'Enter the last 2–4 characters of your ID number'),
  emergency_contact_name: z.string().trim().max(120).optional(),
  emergency_contact_phone: z.string().trim().optional(),
  emergency_contact_relation: z.string().trim().max(60).optional(),
});

type DocumentName = 'id_front' | 'id_back' | 'residence_proof';
type UploadedDocument = { name: DocumentName; file: File; extension: 'jpg' | 'png' | 'pdf'; path: string };

function parseDocument(fileValue: FormDataEntryValue | null, required: boolean): { file?: File; extension?: 'jpg' | 'png' | 'pdf'; error?: string } {
  if (!(fileValue instanceof File) || fileValue.size === 0) {
    return required ? { error: 'Upload the front of your identity document.' } : {};
  }
  if (fileValue.size > 5 * 1024 * 1024) return { error: 'Each document must be 5 MB or smaller.' };

  const extensions: Record<string, 'jpg' | 'png' | 'pdf'> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'application/pdf': 'pdf',
  };
  const extension = extensions[fileValue.type];
  if (!extension) return { error: 'Use JPG, PNG or PDF files only.' };
  return { file: fileValue, extension };
}

async function hasValidFileSignature(file: File, extension: 'jpg' | 'png' | 'pdf') {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (extension === 'jpg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === 'png') return bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  return String.fromCharCode(...bytes.slice(0, 4)) === '%PDF';
}

export async function submitResidentKyc(_: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  if (!profile || profile.role !== 'CUSTOMER' || profile.account_status !== 'PENDING') {
    return { error: 'Sign in with a resident account that is waiting for verification.' };
  }

  const parsed = applicationSchema.safeParse({
    legal_name: formData.get('legal_name'),
    date_of_birth: formData.get('date_of_birth'),
    nationality: formData.get('nationality'),
    resident_type: formData.get('resident_type'),
    id_document_type: formData.get('id_document_type'),
    id_document_last4: formData.get('id_document_last4'),
    emergency_contact_name: String(formData.get('emergency_contact_name') ?? ''),
    emergency_contact_phone: String(formData.get('emergency_contact_phone') ?? ''),
    emergency_contact_relation: String(formData.get('emergency_contact_relation') ?? ''),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the information you entered.' };

  const front = parseDocument(formData.get('id_front'), true);
  const back = parseDocument(formData.get('id_back'), false);
  const proof = parseDocument(formData.get('residence_proof'), false);
  for (const document of [front, back, proof]) {
    if (document.error) return { error: document.error };
  }
  if (!front.file || !front.extension || !await hasValidFileSignature(front.file, front.extension)) {
    return { error: 'The identity document file is invalid. Upload a genuine JPG, PNG or PDF.' };
  }
  for (const document of [back, proof]) {
    if (document.file && document.extension && !await hasValidFileSignature(document.file, document.extension)) {
      return { error: 'One of the uploaded files is invalid. Please check the file and try again.' };
    }
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'Your signed-in account email could not be confirmed. Sign in again.' };

  const db = createAdminClient();
  const { data: existing } = await db.from('resident_kyc')
    .select('status, id_front_storage_path, id_back_storage_path, residence_proof_storage_path')
    .eq('user_id', profile.id).maybeSingle();

  if (existing?.status === 'APPROVED') return { error: 'Your identity has already been approved.' };
  if (existing?.status === 'PENDING') return { error: 'Your KYC application is already under review.' };

  const selected: Array<{ name: DocumentName; file: File; extension: 'jpg' | 'png' | 'pdf' }> = [
    { name: 'id_front', file: front.file, extension: front.extension },
  ];
  if (back.file && back.extension) selected.push({ name: 'id_back', file: back.file, extension: back.extension });
  if (proof.file && proof.extension) selected.push({ name: 'residence_proof', file: proof.file, extension: proof.extension });

  const uploaded: UploadedDocument[] = [];
  for (const item of selected) {
    const path = profile.id + '/' + randomUUID() + '.' + item.extension;
    const { error } = await db.storage.from('resident-kyc').upload(path, item.file, {
      contentType: item.file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      if (uploaded.length) await db.storage.from('resident-kyc').remove(uploaded.map((document) => document.path));
      return { error: 'A document could not be uploaded. Check your connection and try again.' };
    }
    uploaded.push({ ...item, path });
  }

  const pathFor = (name: DocumentName) => uploaded.find((item) => item.name === name)?.path ?? null;
  const { error: saveError } = await db.from('resident_kyc').upsert({
    user_id: profile.id,
    email: user.email,
    ...parsed.data,
    id_document_last4: parsed.data.id_document_last4.toUpperCase(),
    id_front_storage_path: pathFor('id_front'),
    id_back_storage_path: pathFor('id_back'),
    residence_proof_storage_path: pathFor('residence_proof'),
    emergency_contact_name: parsed.data.emergency_contact_name || null,
    emergency_contact_phone: parsed.data.emergency_contact_phone || null,
    emergency_contact_relation: parsed.data.emergency_contact_relation || null,
    status: 'PENDING',
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (saveError) {
    await db.storage.from('resident-kyc').remove(uploaded.map((document) => document.path));
    return { error: 'Your application could not be saved. Please try again.' };
  }

  const oldPaths = [
    existing?.id_front_storage_path,
    existing?.id_back_storage_path,
    existing?.residence_proof_storage_path,
  ].filter((path): path is string => Boolean(path));
  if (oldPaths.length) await db.storage.from('resident-kyc').remove(oldPaths);

  revalidatePath('/resident/verification');
  revalidatePath('/admin/residents');
  return { message: 'Your identity documents were submitted securely. Your account will be activated after the café reviews them.' };
}

export async function reviewResidentKyc(
  userId: string,
  decision: 'APPROVED' | 'REJECTED',
  formData: FormData,
): Promise<void> {
  const actor = await requireRole(MANAGERS);
  const reason = String(formData.get('reason') ?? '').trim();
  if (!z.string().uuid().safeParse(userId).success) throw new Error('Invalid resident account.');
  if (decision === 'REJECTED' && reason.length < 5) throw new Error('Please explain what needs to be corrected.');

  const { error } = await createAdminClient().rpc('review_resident_kyc', {
    p_user_id: userId,
    p_decision: decision,
    p_reason: decision === 'REJECTED' ? reason : null,
    p_actor: actor.id,
  });
  if (error) {
    const messages: Record<string, string> = {
      KYC_APPLICATION_NOT_FOUND: 'This resident has not submitted KYC documents.',
      KYC_APPLICATION_NOT_PENDING: 'This KYC application is no longer waiting for review.',
      MANAGER_REQUIRED: 'Only an active owner or manager can review KYC.',
      REJECTION_REASON_REQUIRED: 'Add a reason before rejecting the application.',
    };
    throw new Error(messages[error.message] ?? 'The KYC review could not be saved.');
  }

  for (const path of ['/admin', '/admin/residents', '/resident/verification', '/menu']) revalidatePath(path);
}
