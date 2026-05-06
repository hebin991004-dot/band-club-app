import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { Calendar, Music, PlusCircle, Loader2, CheckCircle2, PenLine } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [tab, setTab] = useState('cal'); // cal, song, add
  const [events, setEvents] = useState([]);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);

  // 예약 폼 상태
  const [formData, setFormData] = useState({
    title: '',
    unit: '보컬',
    date: '',
    startTime: '',
    endTime: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: resData } = await supabase.from('reservations').select('*');
    const formatted = resData?.map(item => ({
      ...item,
      backgroundColor: getUnitColor(item.unit)
    })) || [];
    setEvents(formatted);

    const { data: songData } = await supabase.from('songs').select('*');
    setSongs(songData || []);
  };

  const getUnitColor = (unit) => {
    const colors = { '드럼': '#ef4444', '보컬': '#f59e0b', '기타': '#10b981', '베이스': '#3b82f6', '키보드': '#8b5cf6' };
    return colors[unit] || '#6366f1';
  };

  // 예약 저장 함수
  const handleAddReservation = async (e) => {
    e.preventDefault();
    setLoading(true);

    const start_time = `${formData.date}T${formData.startTime}:00`;
    const end_time = `${formData.date}T${formData.endTime}:00`;

    const { error } = await supabase.from('reservations').insert([
      { 
        title: formData.title, 
        unit: formData.unit, 
        start: start_time, 
        "end": end_time 
      }
    ]);

    if (error) {
      alert("예약 실패: " + error.message);
    } else {
      alert("예약이 완료되었습니다!");
      setFormData({ title: '', unit: '보컬', date: '', startTime: '', endTime: '' });
      await fetchData(); // 데이터 갱신
      setTab('cal'); // 달력으로 이동
    }
    setLoading(false);
  };

  const groupedSongs = songs.reduce((acc, song) => {
    if (!acc[song.band_name]) acc[song.band_name] = [];
    acc[song.band_name].push(song);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#c4dbff] flex flex-col wrapper">
      {/* --- 로고 섹션 추가 --- */}
        <div className="pt-8 px-5 bg-white flex items-center justify-between">
          <div className="flex w-full justify-center items-center gap-3">
            {/* 핸드드로잉 느낌의 로고 아이콘 */}
            <div>
              <img className='w-20 h-20' src="/캡처.JPG"/>
            </div>
          </div>
        </div>
      {/* 탭 네비게이션 */}
      <nav className="flex bg-white border-b sticky top-0 z-20 overflow-x-auto justify-between">
        {[
          { id: 'cal', label: '예약 현황', icon: <Calendar size={18} /> },
          { id: 'song', label: '합주곡', icon: <Music size={18} /> },
          { id: 'add', label: '예약하기', icon: <PlusCircle size={18} /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[100px] p-4 flex justify-center items-center gap-2 font-bold transition-colors ${
              tab === t.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            {t.icon} <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="p-4 flex-1 max-w-4xl mx-auto w-full p-3">
        {tab === 'cal' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
             <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin]}
              initialView={window.innerWidth < 768 ? "timeGridDay" : "dayGridMonth"}
              events={events}
              locale="ko"
              height="auto"
              headerToolbar={{ left: 'prev,next', center: 'title', right: 'dayGridMonth,timeGridDay' }}
            />
          </div>
        )}

        {tab === 'song' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 font-bold text-gray-600">밴드명</th>
                  <th className="p-4 font-bold text-gray-600">곡 제목</th>
                  <th className="p-4 font-bold text-gray-600">상태</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(groupedSongs).map((bandName) => (
                  groupedSongs[bandName].map((song, idx) => (
                    <tr key={song.id} className="border-b border-gray-50">
                      {idx === 0 && (
                        <td className="p-4 font-bold text-blue-600 bg-blue-50/20" rowSpan={groupedSongs[bandName].length}>
                          {bandName}
                        </td>
                      )}
                      <td className="p-4 text-gray-700">{song.title}</td>
                      <td className="p-4">
                        <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded-full">{song.status}</span>
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'add' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <PlusCircle className="text-blue-600" /> 합주실 예약 신청
            </h2>
            <form onSubmit={handleAddReservation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">예약자명 / 팀명</label>
                <input required type="text" className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="예: A팀 또는 홍길동" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사용 유닛</label>
                <select className="w-full p-3 border rounded-xl outline-none" 
                  value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})}>
                  {['보컬', '드럼', '기타', '베이스', '키보드', '전체합주'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                <input required type="date" className="w-full p-3 border rounded-xl outline-none" 
                  value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
                  <input required type="time" className="w-full p-3 border rounded-xl outline-none" 
                    value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료 시간</label>
                  <input required type="time" className="w-full p-3 border rounded-xl outline-none" 
                    value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} />
                </div>
              </div>
              <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-gray-300 flex justify-center items-center gap-2">
                {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                {loading ? '처리 중...' : '예약 확정'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;