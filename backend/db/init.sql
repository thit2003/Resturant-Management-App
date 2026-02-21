-- USERS

CREATE TABLE IF NOT EXISTS app_user (

  user_id SERIAL PRIMARY KEY,

  name TEXT NOT NULL,

  dob DATE,

  email TEXT UNIQUE NOT NULL,

  password TEXT NOT NULL,

  role TEXT NOT NULL CHECK (role IN ('manager','chef','staff','cashier'))

);

-- multi-valued phone

CREATE TABLE IF NOT EXISTS user_phone (

  user_id INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,

  phone_no TEXT NOT NULL,

  PRIMARY KEY (user_id, phone_no)

);

-- TABLES

CREATE TABLE IF NOT EXISTS restaurant_table (

  table_id SERIAL PRIMARY KEY,

  table_no TEXT UNIQUE NOT NULL,

  capacity INT NOT NULL CHECK (capacity > 0)

);

-- MENU

CREATE TABLE IF NOT EXISTS menu_item (

  menu_item_id SERIAL PRIMARY KEY,

  name TEXT NOT NULL,

  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),

  is_available BOOLEAN NOT NULL DEFAULT TRUE,

  photo TEXT

);

-- multi-valued category

CREATE TABLE IF NOT EXISTS menu_item_category (

  menu_item_id INT NOT NULL REFERENCES menu_item(menu_item_id) ON DELETE CASCADE,

  category TEXT NOT NULL,

  PRIMARY KEY (menu_item_id, category)

);

CREATE INDEX IF NOT EXISTS idx_menu_item_category_item

  ON menu_item_category(menu_item_id);

-- ORDERS

CREATE TABLE IF NOT EXISTS orders (

  order_id SERIAL PRIMARY KEY,

  order_time TIMESTAMP NOT NULL DEFAULT NOW(),

  table_id INT NOT NULL REFERENCES restaurant_table(table_id),

  user_id INT NOT NULL REFERENCES app_user(user_id),  -- staff

  status TEXT NOT NULL CHECK (status IN ('new','processing','ready','paid')) DEFAULT 'new'

);

-- ORDER ITEMS

CREATE TABLE IF NOT EXISTS order_item (

  order_item_id SERIAL PRIMARY KEY,

  order_id INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,

  menu_item_id INT NOT NULL REFERENCES menu_item(menu_item_id),

  quantity INT NOT NULL CHECK (quantity > 0),

  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0)

);

-- KITCHEN STATUS (1:1 with order)

CREATE TABLE IF NOT EXISTS kitchen_status (

  kitchen_status_id SERIAL PRIMARY KEY,

  order_id INT NOT NULL UNIQUE REFERENCES orders(order_id) ON DELETE CASCADE,

  chef_user_id INT REFERENCES app_user(user_id),

  kitchen_status TEXT NOT NULL CHECK (kitchen_status IN ('new','processing','ready')) DEFAULT 'new',

  start_time TIMESTAMP,

  finish_time TIMESTAMP

);

-- PAYMENT (0..1 payment per order, so order_id UNIQUE)

CREATE TABLE IF NOT EXISTS payment (

  payment_id SERIAL PRIMARY KEY,

  order_id INT NOT NULL UNIQUE REFERENCES orders(order_id) ON DELETE CASCADE,

  cashier_user_id INT REFERENCES app_user(user_id),

  pay_time TIMESTAMP NOT NULL DEFAULT NOW(),

  method TEXT NOT NULL CHECK (method IN ('cash','card','qr')),

  amount NUMERIC(10,2) NOT NULL DEFAULT 0,

  tax NUMERIC(10,2) NOT NULL DEFAULT 0,

  discount NUMERIC(10,2) NOT NULL DEFAULT 0,

  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending','paid')) DEFAULT 'paid'

);

-- Derived helper view (optional)

CREATE OR REPLACE VIEW v_order_subtotal AS

SELECT o.order_id, COALESCE(SUM(oi.quantity * oi.unit_price),0) AS subtotal

FROM orders o

LEFT JOIN order_item oi ON oi.order_id=o.order_id

GROUP BY o.order_id;
 
