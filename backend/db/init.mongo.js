db = db.getSiblingDB('restaurant_db');

db.createCollection('app_user');
db.createCollection('restaurant_table');
db.createCollection('menu_item');
db.createCollection('orders');
db.createCollection('order_item');
db.createCollection('kitchen_status');
db.createCollection('payment');
db.createCollection('counters');

db.app_user.createIndex({ user_id: 1 }, { unique: true });
db.app_user.createIndex({ email: 1 }, { unique: true });

db.restaurant_table.createIndex({ table_id: 1 }, { unique: true });
db.restaurant_table.createIndex({ table_no: 1 }, { unique: true });

db.menu_item.createIndex({ menu_item_id: 1 }, { unique: true });
db.menu_item.createIndex({ categories: 1 });

db.orders.createIndex({ order_id: 1 }, { unique: true });
db.orders.createIndex({ table_id: 1 });
db.orders.createIndex({ user_id: 1 });
db.orders.createIndex({ order_time: 1 });

db.order_item.createIndex({ order_item_id: 1 }, { unique: true });
db.order_item.createIndex({ order_id: 1 });
db.order_item.createIndex({ menu_item_id: 1 });

db.kitchen_status.createIndex({ kitchen_status_id: 1 }, { unique: true });
db.kitchen_status.createIndex({ order_id: 1 }, { unique: true });

db.payment.createIndex({ payment_id: 1 }, { unique: true });
db.payment.createIndex({ order_id: 1 }, { unique: true });
db.payment.createIndex({ pay_time: 1 });

print('MongoDB collections and indexes initialized for restaurant_db');
