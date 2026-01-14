'use client';

import { Button } from './Button';
import { 
  Download, 
  Plus, 
  Trash2, 
  Check, 
  ArrowRight,
  Sparkles,
  Upload,
  Save
} from 'lucide-react';

/**
 * 버튼 컴포넌트 사용 예시
 * 
 * 학생 상세 페이지에서 사용할 수 있는 세련된 버튼 스타일들
 */
export function ButtonShowcase() {
  return (
    <div className="space-y-8 p-8 bg-slate-950">
      {/* Primary Buttons */}
      <div className="space-y-4">
        <h3 className="text-white text-lg font-semibold">Primary Buttons</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
            학생 추가
          </Button>
          <Button variant="primary" size="md" leftIcon={<Download size={18} />}>
            다운로드
          </Button>
          <Button variant="primary" size="lg" rightIcon={<ArrowRight size={20} />}>
            다음 단계
          </Button>
        </div>
      </div>

      {/* Gradient Buttons */}
      <div className="space-y-4">
        <h3 className="text-white text-lg font-semibold">Gradient Buttons (추천!)</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="gradient" size="sm" leftIcon={<Sparkles size={16} />}>
            AI 분석
          </Button>
          <Button variant="gradient" size="md" leftIcon={<Download size={18} />}>
            PDF 다운로드
          </Button>
          <Button variant="gradient" size="lg" leftIcon={<Save size={20} />}>
            변경사항 저장
          </Button>
        </div>
      </div>

      {/* Glass Buttons */}
      <div className="space-y-4">
        <h3 className="text-white text-lg font-semibold">Glass Buttons (다크모드용)</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="glass" size="sm" leftIcon={<Upload size={16} />}>
            파일 업로드
          </Button>
          <Button variant="glass" size="md">
            설정
          </Button>
          <Button variant="glass" size="lg" rightIcon={<Check size={20} />}>
            확인
          </Button>
        </div>
      </div>

      {/* Other Variants */}
      <div className="space-y-4">
        <h3 className="text-white text-lg font-semibold">Other Variants</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="success" leftIcon={<Check size={18} />}>Success</Button>
          <Button variant="warning">Warning</Button>
          <Button variant="danger" leftIcon={<Trash2 size={18} />}>Delete</Button>
        </div>
      </div>

      {/* Loading States */}
      <div className="space-y-4">
        <h3 className="text-white text-lg font-semibold">Loading States</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" loading>Loading...</Button>
          <Button variant="gradient" loading>Processing...</Button>
          <Button variant="glass" loading>Saving...</Button>
        </div>
      </div>

      {/* Sizes */}
      <div className="space-y-4">
        <h3 className="text-white text-lg font-semibold">All Sizes</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="gradient" size="xs">Extra Small</Button>
          <Button variant="gradient" size="sm">Small</Button>
          <Button variant="gradient" size="md">Medium</Button>
          <Button variant="gradient" size="lg">Large</Button>
          <Button variant="gradient" size="xl">Extra Large</Button>
        </div>
      </div>

      {/* Full Width */}
      <div className="space-y-4">
        <h3 className="text-white text-lg font-semibold">Full Width</h3>
        <Button variant="gradient" fullWidth leftIcon={<Download size={18} />}>
          전체 너비 버튼
        </Button>
      </div>
    </div>
  );
}