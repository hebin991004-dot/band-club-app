import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction'
import { Calendar, Music, PlusCircle} from 'lucide-react';
import type { Song } from './App.type';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

type Tab = 'cal' | 'song' | 'add';

function App() {
  const [tab, setTab] = useState<Tab>('cal'); // cal, song, add
  const [events, setEvents] = useState<any[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // 예약 폼 상태
  const [formData, setFormData] = useState<{ unit: string; id?: number; date: string; startHour: number, duration: number }>({
    unit: '도원결의',
    date: new Date().toISOString().split('T')[0],
    startHour: 18, // 오후 6시 기본값
    duration: 1    // 오후 8시 기본값
  });

  // 현재 선택된 날짜 (기본값은 오늘)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // FullCalendar의 dateClick 이벤트 핸들러
  const handleDateClick = (arg: { dateStr: string }) => {
    setSelectedDate(arg.dateStr);
    setFormData({ ...formData, date: arg.dateStr }); // 예약 폼의 날짜도 함께 변경
  };

  const selectedDayReservations = events
    .filter(res => res.start.split('T')[0] === selectedDate)
    .sort((a, b) => a.start.localeCompare(b.start)); // 시간순 정렬

  useEffect(() => {
    fetchData();
    fetchSongData();
  }, []);

  const fetchData = async () => {
    const { data: resData } = await supabase.from('reservations').select('*');
    const formatted = resData?.map((item, index) => ({
      ...item,
      backgroundColor: calendarItemColors[index]
    })) || [];
    setEvents(formatted);
  };

  const fetchSongData = async () => {
    const { data: songData } = await supabase.from('songs').select('*');
    setSongs(songData || []);
  };
  const [editingId, setEditingId] = useState(null);

  const calendarItemColors = [
    '#ef4444',
    '#f59e0b',
    '#10b981',
    '#3b82f6'
  ]

  const handleAddReservation:React.SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();

    const startH = formData.startHour;
    const dur = formData.duration;
    const endH = startH + dur;

    // 1. 중복 예약 검증 (나 자신은 제외하고 검사해야 함)
    const isOverlap = events.some(res => {
      // 1. 수정 중인 자기 자신은 무조건 제외
      if (editingId && res.id === editingId) return false;

      // 2. 날짜가 다르면 제외
      const resDate = res.start.split('T')[0];
      if (resDate !== formData.date) return false;

      // 3. 시간을 숫자로 변환 (예: "09:00:00" -> 9)
      const resStart = parseInt(res.start.split('T')[1].split(':')[0]);
      const resEnd = parseInt(res.end.split('T')[1].split(':')[0]);

      const myStart = formData.startHour;
      const myEnd = myStart + formData.duration;

      // 4. 겹침 판정 공식 (매우 중요)
      // 내 시작이 상대 종료보다 작고, 내 종료가 상대 시작보다 커야 겹침
      // 딱 붙어있는 경우(예: 18시 종료, 18시 시작)는 겹치지 않게 처리
      return myStart < resEnd && myEnd > resStart;
    });

    if (isOverlap) {
      alert("해당 시간에 이미 예약이 있습니다! 😭");
      return;
    }

    setLoading(true);
    const start_iso = `${formData.date}T${`${formData.startHour}`.padStart(2, '0')}:00:00`;
    const end_iso = `${formData.date}T${String(endH).padStart(2, '0')}:00:00`;

    const reservationData = {
      unit: formData.unit,
      start: start_iso,
      end: end_iso
    };

    let result;

    if (editingId) {
      // [UPDATE] 이미 ID가 있으면 해당 행을 수정
      result = await supabase
        .from('reservations')
        .update(reservationData)
        .eq('id', editingId);
    } else {
      // [INSERT] ID가 없으면 새로 추가
      result = await supabase
        .from('reservations')
        .insert([reservationData]);
    }

    if (result.error) {
      alert("저장 실패: " + result.error.message);
    } else {
      alert(editingId ? "예약이 수정되었습니다! ✨" : "새 예약이 등록되었습니다! 🎸");

      // 폼 초기화 및 상태 리셋
      setFormData({ unit: '전체합주', date: new Date().toISOString().split('T')[0], startHour: 18, duration: 2 });
      setEditingId(null);
      fetchData();
    }
    setLoading(false);
  };

  const groupedSongs = songs.reduce((acc:any, song:any) => {
    if (!acc[song.band_name]) acc[song.band_name] = [];
    acc[song.band_name].push(song);
    return acc;
  }, {} as Record<string, Song[]>);

  const getReservedHours = () => {
    const reservedHours: number[] = [];

    events.forEach(res => {
      const resDate = res.start.split('T')[0];

      // 1. 날짜가 같은지 확인
      // 2. [핵심] 현재 수정 중인 예약(editingId)은 제외하고 계산
      if (resDate === formData.date && (editingId ? res.id !== editingId : true)) {
        const start = parseInt(res.start.split('T')[1].split(':')[0]);
        const end = parseInt(res.end.split('T')[1].split(':')[0]);

        for (let i = start; i < end; i++) {
          reservedHours.push(i);
        }
      }
    });
    return reservedHours;
  };
  const reservedHours = getReservedHours();
  // 1. 선택한 시작 시간 이후로 "가장 빨리 시작되는 예약"까지 남은 시간 계산
  const getMaxDuration = () => {
    const startH = formData.startHour;
    let maxDur = 4; // 기본 최대 4시간

    const futureReservations = events
      .filter(res => {
        // 1. 같은 날짜여야 함
        const isSameDate = res.start.split('T')[0] === formData.date;
        // 2. [핵심] 현재 수정 중인 예약(editingId)은 검사 대상에서 제외!
        const isNotSelf = editingId ? res.id !== editingId : true;

        return isSameDate && isNotSelf;
      })
      .map(res => parseInt(res.start.split('T')[1].split(':')[0]))
      .filter(resStartH => resStartH > startH) // 내 시작 시간보다 뒤에 있는 것들
      .sort((a, b) => a - b);

    if (futureReservations.length > 0) {
      const limit = futureReservations[0] - startH;
      maxDur = Math.min(maxDur, limit);
    }

    // 운영 종료 시간(24시) 고려
    const timeLeftUntilMidnight = 24 - startH;
    maxDur = Math.min(maxDur, timeLeftUntilMidnight);

    return maxDur;
  };
  const handleDelete = async (id: number) => {
    if (!window.confirm("정말 이 예약을 취소하시겠어요?")) return;

    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', id);

    if (error) {
      alert("삭제 중 오류가 발생했습니다.");
    } else {
      alert("예약이 취소되었습니다.");
      fetchData(); // 목록 새로고침
    }
  };
  // 2. JSX에서 사용
  const availableMax = getMaxDuration();

  // 현재 메뉴가 열린 예약 항목을 저장
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [selectedResForAction, setSelectedResForAction] = useState<any>(null);

  // 카드를 눌렀을 때 실행
  const openActionSheet = (res:any) => {
    setSelectedResForAction(res);
    setShowActionSheet(true);
  };

  // 메뉴 닫기
  const closeActionSheet = () => {
    setShowActionSheet(false);
    setSelectedResForAction(null);
  };


  const handleEdit = (res:any) => {
    setEditingId(res.id);
    setTab('add')
    setFormData({
      id: res.id,
      unit: res.unit,
      date: res.start.split('T')[0],
      startHour: res.start.split('T')[1].split(':')[0],
      duration: parseInt(res.end.split('T')[1].split(':')[0]) - parseInt(res.start.split('T')[1].split(':')[0])
    });
    // 이후 스크롤을 입력 폼으로 이동시키는 로직을 추가하면 좋습니다.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <div className="min-h-screen bg-[#c4dbff] flex flex-col wrapper">
      {/* --- 로고 섹션 추가 --- */}
      <div className="pt-8 px-5 bg-white flex items-center justify-between">
        <div className="flex w-full justify-center items-center gap-3">
          {/* 핸드드로잉 느낌의 로고 아이콘 */}
          <div>
            <img className='w-full max-w-100' src="/logo.png" />
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
            onClick={() => setTab(t.id as Tab)}
            className={`flex-1 min-w-[100px] p-4 flex justify-center items-center gap-2 font-bold transition-colors ${tab === t.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:bg-gray-50'
              }`}
          >
            {t.icon} <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="p-4 flex-1 max-w-4xl mx-auto w-full p-3">
        {tab === 'cal' && (
          <div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={"dayGridMonth"}
                selectable={true}
                events={events}
                locale="ko"
                height="auto"
                dayMaxEvents={true}
                handleWindowResize={true}
                dateClick={handleDateClick} // 날짜 클릭 시 함수 실행
                eventContent={(eventInfo) => {
                  return (
                    <div className="flex items-center justify-center gap-1 py-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
                      <span className="text-[9px] font-medium text-slate-600">
                        {eventInfo.timeText.replace(':00', '')}
                      </span>
                    </div>
                  )
                }}
                headerToolbar={{ left: 'prev,next', center: 'title', right: 'today' }}
              />
            </div>

            <div className="mt-5 w-full mx-auto">
                {selectedDayReservations.length > 0 ? (
                  selectedDayReservations.map((res, idx) => {
                    const startH = res.start.split('T')[1].split(':')[0];
                    const endH = res.end.split('T')[1].split(':')[0];
                    const duration = parseInt(endH) - parseInt(startH);

                    return (
                      <div onClick={() => openActionSheet(res)} key={idx} className="relative flex items-center gap-6 group">
                        <div className="flex-1 bg-[#ffffff90] py-3 px-4 rounded-2xl">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 bg-blue-500 rounded-full`}></div>
                                <h4 className="font-bold text-slate-700 text-lg">{res.unit}</h4>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-slate-400 ml-3">
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  {startH}:00 - {endH}:00
                                </span>
                                <span className="font-medium text-blue-400 bg-blue-50 px-2 py-0.5 rounded italic">
                                  {duration}h session
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  )
                ) : (
                  <div className="text-center gap-3 p-4 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-sm mb-4">
                      <span className="text-2xl">🌊</span>
                    </div>
                    <p className="text-slate-500 font-bold">비어있는 타임라인</p>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest text-[10px]">Be the first to perform</p>
                  </div>
                )}
              </div>
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
                  groupedSongs[bandName].map((song:any, idx:number) => (
                    <tr key={song.id} className="border-b border-gray-50">
                      {idx === 0 && (
                        <td className="p-4 font-bold text-blue-600 bg-blue-50/20" rowSpan={groupedSongs[bandName].length}>
                          {bandName}
                        </td>
                      )}
                      <td className="p-4 text-gray-700">{song.title}</td>
                      <td className="p-4">
                        {
                          song.status === '완료' ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            {song.status}
                          </span> :
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-100">
                              {song.status}
                            </span>

                        }
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
                <label className="block text-sm font-medium text-gray-700 mb-1">사용 유닛</label>
                <select className="w-full border-b-2 border-gray-200 p-2 bg-transparent outline-none"
                  value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                  {['도원결의', '뇌출혈(Natural)', 'Zi존밴드', 'Bandwith', '전체합주'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                <input required type="date" className="w-full border-b-2 border-gray-200 p-2 bg-transparent outline-none"
                  value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold opacity-50">몇시부터 사용하세요?</label>
                  <select
                    className="w-full border-b-2 border-gray-200 p-2 bg-transparent outline-none"
                    value={formData.startHour}
                    onChange={(e) => setFormData({ ...formData, startHour: parseInt(e.target.value) })}
                  >
                    {[...Array(24)].map((_, i) => {
                      const isReserved = reservedHours.includes(i);
                      return (
                        <option key={i} value={String(i).padStart(2, '0')} disabled={isReserved}>
                          {i < 12 ? `오전 ${i}시` : `오후 ${i === 12 ? 12 : i - 12}시`}
                          {isReserved ? " (예약됨)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold opacity-50">얼마나 빌릴까요?</label>
                  <select
                    className="w-full border-b-2 border-gray-200 p-2 bg-transparent outline-none"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  >
                    {/* 1시간부터 사용 가능한 최대 시간까지만 옵션 생성 */}
                    {Array.from({ length: availableMax }, (_, i) => i + 1).map(h => (
                      <option key={h} value={h}>{h}시간 동안</option>
                    ))}

                    {/* 만약 예약이 꽉 차서 빌릴 시간이 없다면? */}
                    {availableMax <= 0 && <option disabled>예약 불가 (다음 예약 있음)</option>}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className={`w-full p-4 rounded-2xl font-bold text-white transition-all ${editingId ? 'bg-orange-500 shadow-orange-200' : 'bg-blue-600 shadow-blue-200'} shadow-lg`}
              >
                {loading ? '처리 중...' : (editingId ? '🛠 예약 내용 수정하기' : '🎸 예약 확정하기')}
              </button>
              {/* 수정 모드일 때만 나타나는 취소 버튼 */}
              {editingId && (
                <button
                  onClick={() => { setEditingId(null); /* 폼 초기화 로직 */ }}
                  className="w-full mt-2 p-2 text-slate-400 text-sm underline"
                >
                  수정 취소하고 새로 예약하기
                </button>
              )}
            </form>
          </div>
        )}
      </main>
      {/* 뒷 배경 레이어 (검은 반투명) */}
      {showActionSheet && (
        <div
          className="fixed inset-0 bg-black/40 z-[100] transition-opacity"
          onClick={closeActionSheet}
        />
      )}

      {/* 바텀 시트 본체 */}
      <div className={`fixed bottom-0 left-0 right-0 bg-white z-[101] rounded-t-3xl transition-transform duration-300 ease-out transform ${showActionSheet ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-xl mx-auto p-6 pb-10">
          {/* 상단 핸들 (바) */}
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />

          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-800">{selectedResForAction?.title}</h3>
            <p className="text-sm text-slate-400">이 예약에 대해 수행할 작업을 선택하세요.</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                handleEdit(selectedResForAction);
                closeActionSheet();
              }}
              className="w-full flex items-center justify-center gap-3 p-4 bg-slate-50 text-slate-800 font-bold rounded-2xl active:bg-blue-50 active:text-blue-600 transition-colors"
            >
              ✏️ 수정하기
            </button>

            <button
              onClick={() => {
                handleDelete(selectedResForAction?.id);
                closeActionSheet();
              }}
              className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 text-red-600 font-bold rounded-2xl active:bg-red-100 transition-colors"
            >
              🗑️ 예약 취소하기
            </button>

            <button
              onClick={closeActionSheet}
              className="w-full p-4 text-slate-400 font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;