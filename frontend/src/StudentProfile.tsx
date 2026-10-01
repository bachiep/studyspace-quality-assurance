import { FormEvent, useState } from "react";
import { api, Session } from "./api";

export function StudentProfile({ session, onUpdate }: { session: Session; onUpdate: (user: Session["user"]) => void }) {
  const [name, setName] = useState(session.user.name);
  const [email, setEmail] = useState(session.user.email);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    try { const user = await api.updateProfile(session.token, { name, email }); onUpdate(user); setNotice("Đã cập nhật hồ sơ."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật hồ sơ."); }
  }
  return <section className="card mt-6 p-5"><h2 className="text-xl font-bold">Hồ sơ của tôi</h2><p className="mt-1 text-sm text-slate-500">Thông tin này được lưu cùng audit log.</p>{notice && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}{error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}<form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={submit}><label><span className="label">Họ và tên</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} required minLength={2}/></label><label><span className="label">Email</span><input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required/></label><button className="button-primary self-end">Lưu hồ sơ</button></form></section>;
}
