import { useRef, useState, useCallback } from 'react';
import SvgDrawingPlayground from './components/SvgDrawingPlayground';
import styles from './App.module.css';

function App() {
  const playgroundRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState('SVG 파일을 업로드해주세요');
  const [statusType, setStatusType] = useState(''); // 'Success', 'Drawing', 'Ready'
  const [hasSvg, setHasSvg] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const updateStatus = useCallback((msg, type = '') => {
    setStatus(msg);
    setStatusType(type);
  }, []);

  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    if (file.type !== 'image/svg+xml' && !file.name.endsWith('.svg')) {
      alert('SVG 파일만 업로드 가능합니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const svgContent = e.target.result;
      if (playgroundRef.current) {
        playgroundRef.current.load(svgContent);
      }
    };
    reader.readAsText(file);
  }, []);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const onFileInputChange = useCallback((e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handlePlay = useCallback(() => {
    if (playgroundRef.current && hasSvg) {
      playgroundRef.current.play();
    }
  }, [hasSvg]);

  const handleReset = useCallback(() => {
    if (playgroundRef.current && hasSvg) {
      playgroundRef.current.reset();
      setIsPlaying(false);
      updateStatus('SVG 초기화 완료. Play를 눌러주세요.', 'Success');
    }
  }, [hasSvg, updateStatus]);

  const handleLoaded = useCallback(({ elementCount }) => {
    setHasSvg(true);
    setIsPlaying(false);
    updateStatus(`SVG 로드 완료 (${elementCount}개 요소). Play를 눌러주세요.`, 'Success');
  }, [updateStatus]);

  const handleDrawStart = useCallback(() => {
    setIsPlaying(true);
    updateStatus('그리기 애니메이션 진행 중...', 'Drawing');
  }, [updateStatus]);

  const handleColorizeStart = useCallback(() => {
    updateStatus('채색 중...', 'Drawing');
  }, [updateStatus]);

  const handleReady = useCallback(() => {
    setIsPlaying(false);
    updateStatus('완료! 요소에 마우스를 올려보세요.', 'Ready');
  }, [updateStatus]);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>SVG Drawing Playground</h1>
        <p>React 리팩토링 버전</p>
      </header>
      
      <main className={styles.main}>
        <label 
          className={`${styles.uploadArea} ${isDragOver ? styles.dragOver : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <span className={styles.uploadIcon}>📂</span>
          <div className={styles.uploadLabel}>클릭하거나 SVG 파일을 드래그 & 드롭하세요</div>
          <div className={styles.uploadHint}>SVG 파일만 지원됩니다</div>
          <input 
            type="file" 
            accept=".svg, image/svg+xml" 
            className={styles.fileInput} 
            onChange={onFileInputChange} 
          />
        </label>

        <div className={styles.controls}>
          <button 
            className={`${styles.btn} ${styles.btnPrimary}`} 
            onClick={handlePlay} 
            disabled={!hasSvg || isPlaying}
          >
            ▶ Play
          </button>
          <button 
            className={`${styles.btn} ${styles.btnSecondary}`} 
            onClick={handleReset} 
            disabled={!hasSvg || isPlaying}
          >
            ↺ Reset
          </button>
        </div>

        <div className={`${styles.statusBar} ${statusType ? styles[`status${statusType}`] : ''}`}>
          {statusType === 'Drawing' && <span className={styles.spinner}></span>}
          {status}
        </div>

        <div className={styles.previewContainer}>
          {!hasSvg && (
            <div className={styles.previewEmpty}>
              <span className={styles.emptyIcon}>🎨</span>
              미리보기 영역
            </div>
          )}
          <SvgDrawingPlayground 
            ref={playgroundRef}
            onLoaded={handleLoaded}
            onDrawStart={handleDrawStart}
            onColorizeStart={handleColorizeStart}
            onReady={handleReady}
            style={{ display: hasSvg ? 'block' : 'none' }}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
