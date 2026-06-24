import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/hooks/useToast';
import apiClient from '@/lib/api/client';
import { getSessionErrorMessage } from './session-group-model';

type AddTab = 'rest' | 'trial' | 'pending' | 'test_new';

interface Candidate {
  id: number;
  name: string;
  gender: 'M' | 'F';
  school?: string;
  grade?: string;
}

const TABS: { key: AddTab; label: string }[] = [
  { key: 'rest', label: '휴원생' },
  { key: 'trial', label: '체험생' },
  { key: 'pending', label: '미등록학생' },
  { key: 'test_new', label: '테스트신규' },
];

export function AddParticipantModal({
  isOpen,
  onAdded,
  onClose,
  sessionId,
  testMonth,
}: {
  isOpen: boolean;
  onAdded: () => void;
  onClose: () => void;
  sessionId: string;
  testMonth: string;
}) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<AddTab>('rest');
  const [adding, setAdding] = useState(false);
  const [applicants, setApplicants] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [newGender, setNewGender] = useState<'M' | 'F'>('M');
  const [newGrade, setNewGrade] = useState('');
  const [newName, setNewName] = useState('');
  const [newSchool, setNewSchool] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showNewForm, setShowNewForm] = useState(false);
  const [students, setStudents] = useState<Candidate[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set());
    fetchList();
  }, [activeTab, isOpen]);

  const currentList = activeTab === 'test_new' ? applicants : students;

  async function fetchList() {
    setLoading(true);
    try {
      const res = await apiClient.get(`/test-sessions/${sessionId}/available-students?type=${activeTab}`);
      if (activeTab === 'test_new') {
        setApplicants(res.data.students || []);
        setStudents([]);
      } else {
        setStudents(res.data.students || []);
        setApplicants([]);
      }
    } catch (error) {
      toast.error(getSessionErrorMessage(error, '추가 가능한 학생을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function handleAdd() {
    if (selected.size === 0) return;
    setAdding(true);
    try {
      const participantType = activeTab === 'rest' ? 'rest' : activeTab === 'trial' ? 'trial' : 'test_new';
      await Promise.all(Array.from(selected).map((id) => (
        apiClient.post(`/test-sessions/${sessionId}/participants`, {
          paca_student_id: activeTab === 'rest' || activeTab === 'trial' || activeTab === 'pending' ? id : undefined,
          test_applicant_id: activeTab === 'test_new' ? id : undefined,
          participant_type: participantType,
        })
      )));
      setSelected(new Set());
      onAdded();
      onClose();
    } catch (error) {
      toast.error(getSessionErrorMessage(error, '참가자를 추가하지 못했습니다.'));
    } finally {
      setAdding(false);
    }
  }

  async function handleAddNew() {
    if (!newName.trim()) return toast.error('이름을 입력해주세요.');
    setAdding(true);
    try {
      const res = await apiClient.post('/test-applicants', {
        gender: newGender,
        grade: newGrade,
        name: newName.trim(),
        school: newSchool,
        test_month: testMonth,
      });
      await apiClient.post(`/test-sessions/${sessionId}/participants`, {
        participant_type: 'test_new',
        test_applicant_id: res.data.id,
      });
      setNewName('');
      setNewSchool('');
      setNewGrade('');
      setShowNewForm(false);
      onAdded();
      onClose();
    } catch (error) {
      toast.error(getSessionErrorMessage(error, '테스트신규를 등록하지 못했습니다.'));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="참가자 추가">
      <div className="min-h-[420px]">
        <div className="mb-4 grid grid-cols-4 overflow-hidden rounded-lg border border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setSelected(new Set());
              }}
              className={`h-11 text-sm font-bold transition ${activeTab === tab.key ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'test_new' && (
          <div className="mb-4">
            {!showNewForm ? (
              <button
                type="button"
                onClick={() => setShowNewForm(true)}
                className="w-full rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm font-bold text-slate-500 hover:border-blue-300 hover:text-blue-700"
              >
                새 테스트신규 등록
              </button>
            ) : (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex gap-2">
                  <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="이름" className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm" />
                  <select value={newGender} onChange={(event) => setNewGender(event.target.value as 'M' | 'F')} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
                    <option value="M">남</option>
                    <option value="F">여</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <input value={newSchool} onChange={(event) => setNewSchool(event.target.value)} placeholder="학교" className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm" />
                  <select value={newGrade} onChange={(event) => setNewGrade(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
                    <option value="">학년</option>
                    {['중1', '중2', '중3', '고1', '고2', '고3', 'N수'].map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>취소</Button>
                  <Button size="sm" onClick={handleAddNew} disabled={adding}>{adding ? '등록 중' : '등록 및 추가'}</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : currentList.length === 0 ? (
          <div className="py-10 text-center text-sm font-semibold text-slate-400">추가 가능한 대상이 없습니다.</div>
        ) : (
          <div className="max-h-[300px] space-y-1 overflow-y-auto">
            {currentList.map((item) => (
              <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 transition ${selected.has(item.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} className="h-4 w-4" />
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${item.gender === 'M' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}>
                  {item.gender === 'M' ? '남' : '여'}
                </span>
                <span className="flex-1 font-bold text-slate-800">{item.name}</span>
                <span className="text-sm text-slate-500">{item.school || ''} {item.grade || ''}</span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-sm font-semibold text-slate-500">{selected.size > 0 ? `${selected.size}명 선택됨` : ''}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button onClick={handleAdd} disabled={adding || selected.size === 0}>{adding ? '추가 중' : '추가'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
