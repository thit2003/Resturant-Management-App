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

const API_ROOT = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(
  /\/+$/,
  '',
);
const API_BASE_URL = API_ROOT.endsWith('/api') ? API_ROOT : `${API_ROOT}/api`;
const apiUrl = (path) => `${API_BASE_URL}/${String(path || '').replace(/^\/+/, '')}`;
const TAX_RATE = 0.07;

const readApiError = async (response, fallback) => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => ({}));
    return payload?.error || `${fallback} (HTTP ${response.status})`;
  }

  const text = await response.text().catch(() => '');
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return `${fallback} (HTTP ${response.status})`;

  if (cleaned.toLowerCase().startsWith('<!doctype html') || cleaned.toLowerCase().includes('<html')) {
    return `${fallback} (HTTP ${response.status}) - backend returned HTML error page`;
  }

  return `${fallback} (HTTP ${response.status}): ${cleaned.slice(0, 200)}`;
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [menu, setMenu] = useState(INITIAL_MENU);
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState(INITIAL_TABLES);
  const [staff, setStaff] = useState(INITIAL_STAFF);

  const fetchMenu = async () => {
    try {
      const res = await fetch(apiUrl('menu'));
      if (!res.ok) {
        throw new Error(await readApiError(res, 'Failed to load menu'));
      }
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
      const res = await fetch(apiUrl('tables'));
      if (!res.ok) throw new Error(await readApiError(res, 'Failed to load tables'));
      const data = await res.json();
      setTables(Array.isArray(data) ? data.map(normalizeTable) : []);
    } catch (error) {
      console.error('Failed to load tables', error);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchTables();
    fetchOrders();
    const menuIntervalId = setInterval(fetchMenu, 10000);
    const tableIntervalId = setInterval(fetchTables, 10000);
    const orderIntervalId = setInterval(fetchOrders, 5000);
    return () => {
      clearInterval(menuIntervalId);
      clearInterval(tableIntervalId);
      clearInterval(orderIntervalId);
    };
  }, []);

  // Login using backend validation
  const login = async (email, password) => {
    try {
      const response = await fetch(apiUrl('auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const message = await readApiError(response, 'Invalid email or password');
        toast.error(message);
        return null;
      }
      const data = await response.json().catch(() => ({}));

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
  const fetchOrders = async () => {
    try {
      const response = await fetch(apiUrl('orders'), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to load orders'));
      }
      const payload = await response.json().catch(() => []);
      setOrders(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('Failed to fetch orders', error);
    }
  };

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

      const response = await fetch(apiUrl('orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(result?.error || 'Failed to create order');
        return null;
      }

      const table = tables.find((t) => t.id === tableId);
      await fetchOrders();
      updateTableStatus(tableId, 'seated');
      toast.success(`Order created for Table ${table?.number ?? ''}`);
      return result;
    } catch (error) {
      console.error('Create order failed', error);
      toast.error('Failed to create order');
      return null;
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const normalizedStatus = String(status || '').toLowerCase();
      const isCancel = normalizedStatus === 'canceled' || normalizedStatus === 'cancelled';
      const response = await fetch(apiUrl(`orders/${orderId}`), {
        method: isCancel ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: isCancel ? undefined : JSON.stringify({ status }),
      });
      if (!response.ok) {
        toast.error(await readApiError(response, 'Failed to update order status'));
        return;
      }
      const payload = await response.json().catch(() => ({}));
      await fetchOrders();
      if (payload?.deleted) {
        toast.success('Order canceled');
      } else {
        toast.success(`Order status: ${status}`);
      }
    } catch (error) {
      console.error('Update order status failed', error);
      const message =
        error?.message && String(error.message).trim()
          ? `Failed to update order status: ${String(error.message)}`
          : 'Failed to update order status';
      toast.error(message);
    }
  };

  const recordPayment = async (orderId, method) => {
    try {
      const response = await fetch(apiUrl(`orders/${orderId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          paymentMethod: String(method || '').toLowerCase(),
          cashierUserId: user?.id || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to record payment');
        return false;
      }
      await fetchOrders();
      toast.success(`Payment method: ${method}`);
      return true;
    } catch (error) {
      console.error('Record payment failed', error);
      toast.error('Failed to record payment');
      return false;
    }
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
      const response = await fetch(apiUrl(`staff/${user.id}`), {
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
      orders, createOrder, updateOrderStatus, recordPayment,
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
