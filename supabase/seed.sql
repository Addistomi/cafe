-- SAMPLE DATA ONLY. Replace with the café's real menu, prices and recipes.
insert into categories (name, sort_order) values
  ('Breakfast', 1), ('Sandwiches', 2), ('Lunch', 3), ('Drinks', 4);

insert into ingredients (name, base_unit, on_hand_quantity, minimum_stock_quantity) values
  ('Chicken',  'GRAM',       5000, 1000), ('Bread',    'PIECE',      60,  10),
  ('Lettuce',  'GRAM',       1500, 300),  ('Tomato',   'GRAM',       2000, 500),
  ('Cheese',   'GRAM',       1200, 300),  ('Mayonnaise','GRAM',      1000, 200),
  ('Eggs',     'PIECE',      90,   20),   ('Tea leaves','GRAM',      800,  100),
  ('Milk',     'MILLILITRE', 6000, 1000), ('Coffee beans','GRAM',    2000, 400),
  ('Injera',   'PIECE',      40,   10),   ('Shiro',    'GRAM',       3000, 500);

insert into meals (category_id, name, slug, description, base_price, preparation_minutes)
select c.id, m.name, m.slug, m.descr, m.price, m.mins from (values
  ('Sandwiches','Chicken Sandwich','chicken-sandwich','Grilled chicken, crisp lettuce and tomato on fresh bread.',250,15),
  ('Breakfast','Egg Sandwich','egg-sandwich','Soft scrambled eggs with cheese on toasted bread.',180,10),
  ('Lunch','Shiro Fitfit','shiro-fitfit','Shiro stew folded through torn injera.',160,12),
  ('Drinks','Spiced Tea','spiced-tea','Black tea with milk and warm spices.',40,5),
  ('Drinks','Macchiato','macchiato','Espresso marked with a spoon of milk foam.',60,5)
) as m(cat, name, slug, descr, price, mins) join categories c on c.name = m.cat;

insert into recipe_ingredients (meal_id, ingredient_id, quantity_per_serving, is_removable)
select m.id, i.id, r.qty, r.removable from (values
  ('chicken-sandwich','Chicken',120,false), ('chicken-sandwich','Bread',1,false),
  ('chicken-sandwich','Lettuce',20,true), ('chicken-sandwich','Tomato',30,true),
  ('chicken-sandwich','Cheese',25,true),  ('chicken-sandwich','Mayonnaise',15,true),
  ('egg-sandwich','Eggs',2,false), ('egg-sandwich','Bread',1,false), ('egg-sandwich','Cheese',25,true),
  ('shiro-fitfit','Shiro',150,false), ('shiro-fitfit','Injera',2,false), ('shiro-fitfit','Tomato',30,true),
  ('spiced-tea','Tea leaves',4,false), ('spiced-tea','Milk',60,true),
  ('macchiato','Coffee beans',18,false), ('macchiato','Milk',30,true)
) as r(slug, ing, qty, removable) join meals m on m.slug = r.slug join ingredients i on i.name = r.ing;

insert into meal_addons (meal_id, name, additional_price, ingredient_id, quantity)
select m.id, a.name, a.price, i.id, a.qty from (values
  ('chicken-sandwich','Extra cheese',30,'Cheese',25), ('chicken-sandwich','Extra chicken',70,'Chicken',100),
  ('egg-sandwich','Extra egg',25,'Eggs',1), ('macchiato','Extra shot',20,'Coffee beans',9)
) as a(slug, name, price, ing, qty) join meals m on m.slug = a.slug join ingredients i on i.name = a.ing;
