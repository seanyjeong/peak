'use client';

import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { ExerciseTag, TagFormData, TAG_COLORS } from './types';

interface TagManagerProps {
  tags: ExerciseTag[];
  form: TagFormData;
  setForm: (form: TagFormData) => void;
  showForm: boolean;
  setShowForm: (show: boolean) => void;
  editingTag: ExerciseTag | null;
  setEditingTag: (tag: ExerciseTag | null) => void;
  onSave: () => void;
  onDelete: (id: number) => void;
}

export function TagManager({
  tags,
  form,
  setForm,
  showForm,
  setShowForm,
  editingTag,
  setEditingTag,
  onSave,
  onDelete,
}: TagManagerProps) {
  const startEditTag = (tag: ExerciseTag) => {
    setEditingTag(tag);
    setForm({ tag_id: tag.tag_id, label: tag.label, color: tag.color });
    setShowForm(true);
  };

  const openNewForm = () => {
    setEditingTag(null);
    setForm({ tag_id: '', label: '', color: 'bg-slate-100 text-slate-700' });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={openNewForm}
        className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
      >
        <Plus size={18} />
        <span>태그 추가</span>
      </button>

      {/* Tag Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">
              {editingTag ? '태그 수정' : '새 태그 추가'}
            </h3>
            <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">태그 ID</label>
              <input
                type="text"
                value={form.tag_id}
                onChange={e => setForm({ ...form, tag_id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="lower-power"
                disabled={!!editingTag}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">표시 이름</label>
              <input
                type="text"
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })}
                placeholder="하체 파워"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">색상</label>
              <select
                value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                {TAG_COLORS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <span className="text-sm text-slate-500">미리보기:</span>
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${form.color}`}>
              {form.label || '태그'}
            </span>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              취소
            </button>
            <button
              onClick={onSave}
              disabled={!form.label.trim() || (!editingTag && !form.tag_id.trim())}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              <Save size={16} />
              저장
            </button>
          </div>
        </div>
      )}

      {/* Tags List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {tags.map(tag => (
            <div key={tag.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${tag.color}`}>
                  {tag.label}
                </span>
                <span className="text-xs text-slate-400">{tag.tag_id}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startEditTag(tag)}
                  className="p-2 text-slate-400 hover:text-orange-500"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => onDelete(tag.id)}
                  className="p-2 text-slate-400 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
