'use client';

import { useState, useRef } from 'react';

interface AdUploadProps {
  slotId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function AdUpload({ slotId, onSuccess, onClose }: AdUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(selected.type)) {
      setError('JPG, PNG, GIF, WebP 이미지만 허용됩니다.');
      return;
    }

    // 파일 크기 검증 (2MB)
    if (selected.size > 2 * 1024 * 1024) {
      setError('이미지 크기는 2MB 이하여야 합니다.');
      return;
    }

    setFile(selected);
    setError(null);

    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selected);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('slotId', slotId);

      const res = await fetch('/api/ad/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.message || '업로드에 실패했습니다.');
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            축하합니다!
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            광고 이미지를 업로드하세요
          </p>
        </div>

        {/* 업로드 영역 */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
            transition-all hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20
            ${preview ? 'border-purple-500' : 'border-zinc-300 dark:border-zinc-600'}
          `}
        >
          {preview ? (
            <img
              src={preview}
              alt="미리보기"
              className="max-h-48 mx-auto rounded-lg"
            />
          ) : (
            <div>
              <div className="text-4xl mb-2">📁</div>
              <p className="text-zinc-600 dark:text-zinc-400">
                클릭하여 이미지 선택
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                JPG, PNG, GIF, WebP (최대 2MB)
              </p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 권장 사이즈 안내 */}
        <div className="mt-4 p-3 bg-zinc-100 dark:bg-zinc-700/50 rounded-lg">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            💡 권장 사이즈: 300 x 250px (세로형 배너)
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              !file || uploading
                ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-lg'
            }`}
          >
            {uploading ? '업로드 중...' : '광고 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
