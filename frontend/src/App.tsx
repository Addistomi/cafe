import { useEffect, useState } from "react";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export default function App() {
  const [api, setApi] = useState("checking");
  useEffect(() => {
    let active = true;
    fetch(API_URL + "/health").then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(() => active && setApi("online")).catch(() => active && setApi("offline"));
    return () => { active = false; };
  }, []);
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#faf6f2",color:"#2b1a10",fontFamily:"system-ui",padding:24}}>
    <section style={{maxWidth:560,background:"white",padding:32,borderRadius:20,border:"1px solid #eadfd5"}}>
      <p style={{color:"#c9520d",fontWeight:800,letterSpacing:2}}>FANA CAFE · NEW PLATFORM</p>
      <h1 style={{fontSize:36}}>A fresh foundation.</h1>
      <p style={{lineHeight:1.6,color:"#6b5a50"}}>The React frontend is connected to the new FastAPI service. Existing resident, admin, kitchen, ordering and payment workflows will be ported in feature-by-feature steps.</p>
      <p style={{marginTop:24,padding:14,borderRadius:12,background:"#faf6f2"}}>API status: <strong>{api}</strong></p>
    </section>
  </main>;
}
