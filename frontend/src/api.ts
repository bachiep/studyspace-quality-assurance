/// <reference types="vite/client" />
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export type Session = { token: string; user: { id: string; name: string; email: string; role: "STUDENT" | "ADMIN" } };
export type Room = { id: string; name: string; capacity: number; location: string; status?: "ACTIVE" | "INACTIVE"; available?: boolean; equipment: Array<{ equipment: { id: string; name: string } }>; closures?: unknown[]; occupiedSlots?: string[] };
export type Booking = { id: string; date: string; startTime: string; endTime: string; status: string; room: Room };
export type AdminUser = { id: string; name: string; email: string; role: "STUDENT" | "ADMIN" };
export type Equipment = { id: string; name: string; _count?: { rooms: number } };
export type Closure = { id: string; roomId: string; date: string; reason: string };

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || "Yêu cầu không thành công.");
  return body as T;
}

export const api = {
  login: (email: string, password: string) => request<Session>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) => request<Session>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  updateProfile: (token: string, input: { name: string; email: string }) => request<Session["user"]>("/auth/me", { method: "PATCH", body: JSON.stringify(input) }, token),
  availability: (date: string) => request<Room[]>(`/rooms/availability?date=${date}`),
  createBooking: (token: string, roomId: string, date: string, startTime: string) => request<Booking>("/bookings", { method: "POST", body: JSON.stringify({ roomId, date, startTime }) }, token),
  myBookings: (token: string) => request<Booking[]>("/bookings/me", {}, token),
  cancel: (token: string, id: string) => request<Booking>(`/bookings/${id}/cancel`, { method: "PATCH" }, token),
  checkIn: (token: string, id: string) => request<Booking>(`/bookings/${id}/check-in`, { method: "PATCH" }, token),
  adminRoom: (token: string, input: { name: string; capacity: number; location: string; equipment: string[] }) => request<Room>("/admin/rooms", { method: "POST", body: JSON.stringify(input) }, token),
  setRoomStatus: (token: string, id: string, status: "ACTIVE" | "INACTIVE") => request<Room>(`/admin/rooms/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token),
  updateRoom: (token: string, id: string, input: Partial<Pick<Room, "name" | "capacity" | "location" | "status">>) => request<Room>(`/admin/rooms/${id}`, { method: "PATCH", body: JSON.stringify(input) }, token),
  setRoomEquipment: (token: string, id: string, equipmentIds: string[]) => request<Room>(`/admin/rooms/${id}/equipment`, { method: "PATCH", body: JSON.stringify({ equipmentIds }) }, token),
  usage: (token: string) => request<{ totals: { bookings: number; checkedIn: number; noShow: number; reservationRate: number; utilizationRate: number; /** @deprecated Use reservationRate. */ occupancyRate: number }; rooms: { roomName: string; bookings: number }[] }>("/admin/reports/usage", {}, token),
  adminUsers: (token: string) => request<AdminUser[]>("/admin/users", {}, token),
  setUserRole: (token: string, id: string, role: "STUDENT" | "ADMIN") => request<AdminUser>(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }, token),
  adminRooms: (token: string) => request<Room[]>("/admin/rooms", {}, token),
  closures: (token: string, roomId: string) => request<Closure[]>(`/admin/rooms/${roomId}/closures`, {}, token),
  createClosure: (token: string, roomId: string, date: string, reason: string) => request<Closure>(`/admin/rooms/${roomId}/closures`, { method: "POST", body: JSON.stringify({ date, reason }) }, token),
  deleteClosure: (token: string, id: string) => request<void>(`/admin/closures/${id}`, { method: "DELETE" }, token),
  equipment: (token: string) => request<Equipment[]>("/admin/equipment", {}, token),
  createEquipment: (token: string, name: string) => request<Equipment>("/admin/equipment", { method: "POST", body: JSON.stringify({ name }) }, token),
  deleteEquipment: (token: string, id: string) => request<void>(`/admin/equipment/${id}`, { method: "DELETE" }, token),
  adminBookings: (token: string) => request<(Booking & { user: { name: string; email: string } })[]>("/admin/bookings", {}, token),
  setBookingStatus: (token: string, id: string, status: "BOOKED" | "CANCELLED" | "CHECKED_IN" | "NO_SHOW") => request<Booking>(`/admin/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token)
};
