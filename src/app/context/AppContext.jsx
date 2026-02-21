import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from "sonner"

const AppContext = createContext(undefined);

// Menu is sourced from backend DB and should not fall back to hardcoded prices.
const INITIAL_MENU = [];

const INITIAL_TABLES = Array.from({ length: 12 }, (_, i) => ({
  id: `t-${i+1}`,
  number: i + 1,
  status: 'free',
  seats: i % 2 === 0 ? 4 : 2,
}));

const INITIAL_STAFF = [
  { id: 'u-1', name: 'John Chef', email: 'chef@rest.com', role: 'chef' },
  { id: 'u-2', name: 'Sarah Server', email: 'staff@rest.com', role: 'staff' },
  { id: 'u-3', name: 'Mike Manager', email: 'manager@rest.com', role: 'manager' },
  { id: 'u-4', name: 'Cathy Cashier', email: 'cashier@rest.com', role: 'cashier' },
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const TAX_RATE = 0.07;

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [menu, setMenu] = useState(INITIAL_MENU);
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState(INITIAL_TABLES);
  const [staff, setStaff] = useState(INITIAL_STAFF);

  const fetchMenu = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/menu`);
      if (!res.ok) throw new Error('Failed to load menu');
      const data = await res.json();
      setMenu(data);
    } catch (error) {
      console.error('Failed to load menu', error);
    }
  };

  const normalizeTable = (table) => ({
    ...table,
    id: String(table?.id || ''),
    number: table?.number ?? '',
    seats: Number(table?.seats || 0),
    status: table?.status || 'free',
  });

  const fetchTables = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tables`);
      if (!res.ok) throw new Error('Failed to load tables');
      const data = await res.json();
      setTables(Array.isArray(data) ? data.map(normalizeTable) : []);
    } catch (error) {
      console.error('Failed to load tables', error);
    }
  };

  const normalizeOrder = (order) => ({
    id: String(order?.id || ''),
    orderId: Number(order?.orderId || 0),
    tableId: String(order?.tableId || ''),
    tableNumber: Number(String(order?.tableId || '').replace(/^t-/i, '')) || null,
    status: String(order?.status || 'pending').toLowerCase(),
    note: String(order?.note || ''),
    paymentMethod: order?.paymentMethod ? String(order.paymentMethod).toLowerCase() : undefined,
    paidAt: order?.paidAt || null,
    createdAt: order?.createdAt || new Date().toISOString(),
    subtotal: Number(order?.subtotal || 0),
    tax: Number(order?.tax || 0),
    total: Number(order?.total || 0),
    items: (Array.isArray(order?.items) ? order.items : []).map((item) => ({
      menuItemId: Number(item?.menuItemId || 0),
      name: item?.name || 'Unknown',
      quantity: Number(item?.quantity || 0),
      price: Number(item?.price || 0),
      protein: item?.protein || 'None',
    })),
  });

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data.map(normalizeOrder) : []);
    } catch (error) {
      console.error('Failed to load orders', error);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchTables();
    fetchOrders();
    const menuIntervalId = setInterval(fetchMenu, 10000);
    const tableIntervalId = setInterval(fetchTables, 10000);
    return () => {
      clearInterval(menuIntervalId);
      clearInterval(tableIntervalId);
    };
  }, []);

  // Login using backend validation
  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error || 'Invalid email or password';
        toast.error(message);
        return null;
      }

      const nextUser = {
        ...data,
        role: String(data?.role || '').toLowerCase(),
        avatar: data?.photo
          ? data.photo
          : `https://ui-avatars.com/api/?name=${data?.name || email.split('@')[0]}&background=random`,
      };
      setUser(nextUser);
      toast.success(`Welcome back, ${nextUser.name}`);
      return nextUser;
    } catch (error) {
      console.error('Login failed', error);
      toast.error('Unable to login. Please try again.');
      return null;
    }
  };

  const logout = () => {
    setUser(null);
    toast.info("Logged out successfully");
  };

  // Menu Management
  const addMenuItem = (item) => {
    setMenu([...menu, { ...item, id: Date.now().toString() }]);
    toast.success("Menu item added");
  };

  const updateMenuItem = (id, updates) => {
    setMenu(menu.map(item => item.id === id ? { ...item, ...updates } : item));
    toast.success("Menu item updated");
  };

  const deleteMenuItem = (id) => {
    setMenu(menu.filter(item => item.id !== id));
    toast.success("Menu item deleted");
  };

  // Order Management
  const createOrder = async (tableId, items, note = "") => {
    try {
      if (!user?.id) {
        toast.error('Please login before creating an order');
        return null;
      }

      const payload = {
        tableId,
        userId: user.id,
        note,
        items: (Array.isArray(items) ? items : []).map((item) => ({
          menuItemId: item.menuItemId ?? item.id,
          quantity: Number(item.quantity || 0),
          protein: item.protein || 'None',
        })),
      };

      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(result?.error || 'Failed to create order');
        return null;
      }

      const resolvedItems = (Array.isArray(result.items) ? result.items : []).map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        protein: item.protein || 'None',
      }));

      const subtotal = resolvedItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0,
      );
      const tax = subtotal * TAX_RATE;
      const total = subtotal + tax;
      const table = tables.find((t) => t.id === tableId);
      const newOrder = {
        id: result.id || `ord-${Date.now()}`,
        tableId: result.tableId || tableId,
        tableNumber: table?.number ?? null,
        items: resolvedItems,
        status: 'pending',
        subtotal,
        tax,
        total,
        note,
        createdAt: result.createdAt || new Date().toISOString(),
      };

      setOrders(prev => [...prev, newOrder]);
      updateTableStatus(tableId, 'seated');
      toast.success(`Order created for Table ${table?.number ?? ''}`);
      return newOrder;
    } catch (error) {
      console.error('Create order failed', error);
      toast.error('Failed to create order');
      return null;
    }
  };

  const updateOrderStatus = (orderId, status) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    toast.success(`Order status: ${status}`);
  };

  const recordPayment = (orderId, method) => {
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? {
              ...o,
              status: 'paid',
              paymentMethod: String(method || '').toLowerCase(),
              paidAt: new Date().toISOString(),
            }
          : o,
      ),
    );
    toast.success(`Payment method: ${method}`);
  };

  const analytics = React.useMemo(() => {
    const isSameDay = (value, now) => {
      const date = new Date(value);
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    };

    const now = new Date();
    const validOrders = orders.filter((order) => order.status !== 'canceled');
    const todayOrders = validOrders.filter((order) => isSameDay(order.createdAt, now));
    const paidOrders = validOrders.filter((order) => order.status === 'paid');
    const todaySales = paidOrders
      .filter((order) => isSameDay(order.paidAt || order.createdAt, now))
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    const itemCountByName = {};
    for (const order of validOrders) {
      for (const item of order.items || []) {
        const key = item.name || 'Unknown';
        itemCountByName[key] = (itemCountByName[key] || 0) + Number(item.quantity || 0);
      }
    }
    const topItems = Object.entries(itemCountByName)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const hourlyOrders = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      orders: 0,
    }));
    for (const order of validOrders) {
      const hour = new Date(order.createdAt).getHours();
      hourlyOrders[hour].orders += 1;
    }

    const paymentMethods = ['cash', 'card', 'qr'];
    const paymentBreakdown = paymentMethods.map((method) => {
      const methodOrders = paidOrders.filter((order) => order.paymentMethod === method);
      return {
        method: method.toUpperCase(),
        count: methodOrders.length,
        revenue: methodOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      };
    });

    const tableIds = new Set(validOrders.map((order) => order.tableId));
    const totalRevenueAllOrders = validOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const averageOrderValue = tableIds.size > 0 ? totalRevenueAllOrders / tableIds.size : 0;

    return {
      todaySales,
      totalOrders: validOrders.length,
      todayOrderCount: todayOrders.length,
      topItems,
      hourlyOrders,
      paymentBreakdown,
      averageOrderValue,
      taxRate: TAX_RATE,
    };
  }, [orders]);

  // Table Management
  const updateTableStatus = (tableId, status) => {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, status } : t));
  };

  // Staff Management
  const addStaff = (newUser) => {
    setStaff(prev => [...prev, { ...newUser, id: `u-${Date.now()}` }]);
    toast.success("Staff member added");
  };

  const updateProfile = async (updates) => {
    if (!user?.id) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/staff/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error || 'Failed to update profile';
        toast.error(message);
        return null;
      }
      const nextUser = {
        ...user,
        ...payload,
        avatar: payload?.photo
          ? payload.photo
          : user.avatar,
      };
      setUser(nextUser);
      toast.success('Profile updated');
      return nextUser;
    } catch (error) {
      console.error('Update profile failed', error);
      toast.error('Failed to update profile');
      return null;
    }
  };

  return (
    <AppContext.Provider value={{
      user, login, logout,
      menu, fetchMenu, addMenuItem, updateMenuItem, deleteMenuItem,
      orders, fetchOrders, createOrder, updateOrderStatus, recordPayment,
      tables, fetchTables, updateTableStatus,
      staff, addStaff,
      updateProfile,
      analytics,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
