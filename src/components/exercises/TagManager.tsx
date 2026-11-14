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
    setForm({ tag_id: '', label: '', color: 'bg-muted text-secondary-foreground' });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={openNewForm}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
      >
        <Plus size={18} />
        <span>태그 추가</span>
      </button>

      {/* Tag Form */}
      {showForm && (
        <div className="bg-card rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">
              {editingTag ? '태그 수정' : '새 태그 추가'}
            </h3>
            <button onClick={() => setShowForm(false)} className="p-2 text-muted-foreground hover:text-secondary-foreground">
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-foreground mb-1">태그 ID</label>
              <input
                type="text"
                value={form.tag_id}
                onChange={e => setForm({ ...form, tag_id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="lower-power"
                disabled={!!editingTag}
                className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-primary disabled:bg-muted"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-foreground mb-1">표시 이름</label>
              <input
                type="text"
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })}
                placeholder="하체 파워"
                className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-foreground mb-1">색상</label>
              <select
                value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })}
                className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg focus:ring-2 focus:ring-primary"
              >
                {TAG_COLORS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <span className="text-sm text-muted-foreground">미리보기:</span>
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${form.color}`}>
              {form.label || '태그'}
            </span>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-secondary-foreground bg-muted rounded-lg hover:bg-border"
            >
              취소
            </button>
            <button
              onClick={onSave}
              disabled={!form.label.trim() || (!editingTag && !form.tag_id.trim())}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              저장
            </button>
          </div>
        </div>
      )}

      {/* Tags List */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <div className="divide-y divide-border">
          {tags.map(tag => (
            <div key={tag.id} className="p-4 flex items-center justify-between hover:bg-muted">
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${tag.color}`}>
                  {tag.label}
                </span>
                <span className="text-xs text-muted-foreground">{tag.tag_id}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startEditTag(tag)}
                  className="p-2 text-muted-foreground hover:text-primary"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => onDelete(tag.id)}
                  className="p-2 text-muted-foreground hover:text-destructive"
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
