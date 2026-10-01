import { useEffect, useState } from "react";
import { api, Booking, Room, Session } from "./api";

const slots = Array.from({ length: 14 }, (_, index) => `${String(index + 7).padStart(2, "0")}:00`);
const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateAfter = (days = 1) => { const date = new Date(); date.setDate(date.getDate() + days); return formatLocalDate(date); };

function Notice({ message, type = "error" }: { message: string; type?: "error" | "success" }) {
  return <p role="alert" className={`rounded-xl px-3 py-2 text-sm ${type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message}</p>;
}

export function BookingPanel({ session }: { session: Session }) {
  const [date, setDate] = useState(dateAfter());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ room: Room; startTime: string } | null>(null);
  const [minimumCapacity, setMinimumCapacity] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [roomData, bookingData] = await Promise.all([api.availability(date), api.myBookings(session.token)]);
      const requiredEquipment = equipmentFilter.split(",").map((name) => name.trim().toLocaleLowerCase()).filter(Boolean);
      const minimum = minimumCapacity ? Number(minimumCapacity) : 0;
      setRooms(roomData.filter((room) => room.capacity >= minimum && requiredEquipment.every((name) => room.equipment.some((item) => item.equipment.name.toLocaleLowerCase() === name)))); setBookings(bookingData);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [date, minimumCapacity, equipmentFilter]);

  async function reserve() {
    if (!pending) return;
    const { room, startTime } = pending;
    setPending(null); setError(""); setMessage("");
    try { await api.createBooking(session.token, room.id, date, startTime); setMessage(`Đã giữ chỗ tại phòng ${room.name}, ${startTime}.`); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể đặt phòng."); }
  }
  async function cancel(id: string) { try { await api.cancel(session.token, id); setMessage("Đã hủy lịch đặt."); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể hủy lịch."); } }
  async function checkIn(id: string) { try { await api.checkIn(session.token, id); setMessage("Đã check-in thành công."); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Chưa thể check-in."); } }

  return <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
    <section className="card p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-bold">Tìm phòng trống</h2><p className="text-sm text-slate-500">Chọn slot còn trống để xem lại thông tin trước khi đặt.</p></div><label><span className="label">Ngày học</span><input className="field" value={date} min={dateAfter(0)} max={dateAfter(14)} type="date" onChange={(event) => setDate(event.target.value)} /></label></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><label><span className="label">Sức chứa tối thiểu</span><input className="field" aria-label="Sức chứa tối thiểu" min="1" type="number" value={minimumCapacity} onChange={(event) => setMinimumCapacity(event.target.value)} placeholder="Ví dụ: 10" /></label><label><span className="label">Thiết bị cần có</span><input className="field" aria-label="Thiết bị cần có" value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)} placeholder="Máy chiếu, Bảng trắng" /></label></div>
      {message && <div className="mt-4"><Notice type="success" message={message} /></div>}{error && <div className="mt-4"><Notice message={error} /></div>}
      {loading ? <p className="py-12 text-center text-slate-500">Đang tìm không gian phù hợp...</p> : <div className="mt-6 space-y-4">{rooms.length === 0 ? <p className="rounded-xl bg-slate-50 p-6 text-center text-slate-500">Chưa có phòng hoạt động.</p> : rooms.map((room) => <article className="rounded-2xl border border-slate-200 p-4" key={room.id}><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">Phòng {room.name} <span className="ml-2 rounded-full bg-brand/10 px-2 py-1 text-xs text-brand">{room.capacity} chỗ</span></h3><p className="mt-1 text-sm text-slate-500">{room.location} · {room.equipment.map((item) => item.equipment.name).join(" · ") || "Thiết bị cơ bản"}</p></div><span className={`text-sm font-semibold ${room.available ? "text-emerald-600" : "text-rose-600"}`}>{room.available ? "Đang mở" : "Đóng phòng"}</span></div><div className="mt-4 flex flex-wrap gap-2">{slots.map((slot) => { const unavailable = !room.available || room.occupiedSlots?.includes(slot); return <button key={slot} disabled={unavailable} onClick={() => setPending({ room, startTime: slot })} className={`rounded-lg px-3 py-2 text-sm font-semibold ${unavailable ? "cursor-not-allowed bg-slate-100 text-slate-400 line-through" : "bg-indigo-50 text-brand hover:bg-brand hover:text-white"}`}>{slot}</button>; })}</div></article>)}</div>}
    </section>
    <aside className="card h-fit p-5"><h2 className="text-xl font-bold">Lịch của tôi</h2><p className="mt-1 text-sm text-slate-500">Theo dõi hoặc hủy lịch khi còn đủ thời gian.</p><div className="mt-4 space-y-3">{bookings.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Bạn chưa có lịch đặt nào.</p> : bookings.map((booking) => <div className="rounded-xl border border-slate-200 p-3" key={booking.id}><div className="flex justify-between gap-2"><b>Phòng {booking.room.name}</b><span className="text-xs font-bold text-brand">{booking.status}</span></div><p className="mt-1 text-sm text-slate-500">{booking.date} · {booking.startTime}–{booking.endTime}</p>{booking.status === "BOOKED" && <div className="mt-3 flex gap-3"><button onClick={() => checkIn(booking.id)} className="text-sm font-semibold text-brand">Check-in</button><button onClick={() => cancel(booking.id)} className="text-sm font-semibold text-rose-600">Hủy lịch</button></div>}</div>)}</div></aside>
    {pending && <div className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 px-4" role="presentation"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="booking-confirm-title"><h2 id="booking-confirm-title" className="text-xl font-bold">Xác nhận đặt chỗ</h2><p className="mt-3 text-sm text-slate-600">Bạn muốn đặt phòng <b>{pending.room.name}</b> vào <b>{date} lúc {pending.startTime}</b>?</p><div className="mt-6 flex justify-end gap-3"><button className="button-secondary" onClick={() => setPending(null)}>Quay lại</button><button className="button-primary" onClick={() => void reserve()}>Xác nhận đặt chỗ</button></div></div></div>}
  </div>;
}
