# DELULU: A Role-Based Web Restaurant Management System

A full-stack **web restaurant management system** designed to replace paper-based workflows with a streamlined, real-time **order-to-payment** lifecycle. The system supports four employee roles—**Manager, Staff (Waiter), Chef, Cashier**—each with distinct permissions and dashboards.

> UI/Prototype reference (Figma): https://www.figma.com/design/ee5qyBs9MTQ6OMZnE3LFcG/Restaurant-Management-App

> Deployment Link (Azure VM): http://webdevfromthitlwin.koreacentral.cloudapp.azure.com/login

---
## Team Members
- Thit Lwin Win Thant
- Honey Linn
- Eaint Myat Thu
---

## Project Overview

### Problem Statement
Traditional paper-based restaurant operations often cause:
- miscommunication between dining area and kitchen
- slow billing and payment handling
- limited visibility into real-time sales performance

### Target Users
Restaurant employees with role-based responsibilities:
- **Manager** <br>
  admin@gmail.com <br>
  1234
- **Staff (Waiter)** <br>
  waiter@rest.com <br>
  1234
- **Chef** <br>
  chef@gmail.com <br>
  1234
- **Cashier** <br>
  cashier@rest.com <br>
  1234

### Why It Matters
This system helps reduce customer waiting time, minimize human errors (orders, tax, totals), and provides managers with instant insights (e.g., daily sales totals) for better decision-making.

---

## Core Features (Scope)

- **Role-Based Access Control (RBAC)**  
  Secure login with distinct permissions for Manager, Staff, Chef, and Cashier.

- **Table Management**  
  Real-time visualization of table status (e.g., Free vs Seated) and seat capacity.

- **Digital Ordering System**  
  Menu browsing + “add to cart” ordering with automatic tax and total calculation.

- **Kitchen Display System (KDS)**  
  Chef workflow to move orders across stages such as **Processing → Finish → Completed**.

- **Manager Dashboard**
  - Today’s Sales
  - Total Orders
  - CRUD for Staff/User management
  - CRUD for Menu management

- **Sales Performance Ranking**  
  Automated **Top 5 best-selling menu items** based on aggregated order quantities.

- **Peak Traffic Visualization**  
  Bar chart showing order volume by hour (helps staffing decisions).

- **Payment Method Analysis**  
  Breakdown of payment types: **Cash vs Card vs QR**.

- **Average Order Value (AOV)**  
  Real-time average revenue per table.

---

## Data Models (High-Level)

### Menu_Item
**Fields:** `menu_item_id`, `name`, `price`, `is_available`, `photo`, `category`  
**Operations:** Manager CRUD; Staff read (view menu)

### App_User
**Fields:** `user_id`, `name`, `email`, `password`, `role` (manager/chef/staff/cashier), `phone_no`  
**Operations:** CRUD staff access + login/authentication

### Order
**Fields:** `order_id`, `table_id`, `user_id` (staff), `order_time`, `status` (new/processing/ready/paid)  
**Operations:** create order, view active, update status, void

### Restaurant Table
**Fields:** `table_id`, `table_no`, `capacity`  
**Operations:** Manager CRUD; Staff read table availability

### Order Item
**Fields:** `order_item_id`, `order_id`, `menu_item_id`, `quantity`, `unit_price`  
**Operations:** add/remove/update items in cart and order summary

### Kitchen Status
**Fields:** `kitchen_status_id`, `order_id`, `chef_user_id`, `kitchen_status`, `start_time`, `finish_time`  
**Operations:** ticket generation, queue viewing, status updates, archive completed

### Payment
**Fields:** `payment_id`, `order_id`, `cashier_user_id`, `pay_time`, `method` (cash/card/qr), `tax`, `discount`, `payment_status`  
**Operations:** invoice creation, transaction viewing, mark paid, void transaction

---

## Tech Stack

- **Frontend:** React.js  
- **Backend:** Node.js (Express)  
- **Database:** MongoDB  
- **Deployment:** Microsoft Azure VM

---

## Running the Code (Development)

### Frontend
Install dependencies and run the development server:
```bash
npm i
npm run dev
```

---

## Backend + MongoDB (Local)

1. **Start MongoDB with Docker**
```bash
cd backend
docker compose up -d
```

2. **Create a single environment file at the project root**
Create a `.env` file in the workspace root and add:
- `MONGODB_URI=<your mongo connection string>`
- `MONGODB_DB=<your database name>`
- `VITE_API_BASE_URL=http://localhost:3003`

3. **Start the backend**
```bash
cd backend
npm i
npm run dev
```

Backend runs on: `http://localhost:3003`

### Backend Environment Requirements
The API expects:
- `MONGODB_URI` (Mongo connection string)
- `MONGODB_DB` (database name)

---
