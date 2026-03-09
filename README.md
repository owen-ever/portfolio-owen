# SVG Drawing Playground

인터랙티브 SVG 라이브 드로잉 React 컴포넌트. SVG 파일을 로드하면 획 하나하나를 순서대로 그리고 채색하는 애니메이션을 제공합니다.

## 설치

```bash
npm install
npm run dev
```

## Import

```jsx
import SvgDrawingPlayground from './src/components/SvgDrawingPlayground';
```

## 기본 사용법

```jsx
import { useRef } from 'react';
import SvgDrawingPlayground from './components/SvgDrawingPlayground';

function App() {
  const playgroundRef = useRef(null);

  const handleFileLoad = async (file) => {
    const svgString = await file.text();
    playgroundRef.current.load(svgString);
  };

  return (
    <div>
      <SvgDrawingPlayground
        ref={playgroundRef}
        onLoaded={({ elementCount }) => console.log(`로드 완료: ${elementCount}개`)}
        onReady={() => console.log('인터랙션 준비 완료')}
      />
      <button onClick={() => playgroundRef.current.play()}>Play</button>
      <button onClick={() => playgroundRef.current.reset()}>Reset</button>
    </div>
  );
}
```

## Props

| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `drawStaggerMs` | number | `166` | 획 사이 딜레이 (ms) |
| `colorizeStaggerMs` | number | `333` | 채색 사이 딜레이 (ms) |
| `speedFactor` | number | `200` | 드로잉 속도 인수 (클수록 빠름) |
| `minDuration` | number | `0.3` | 최소 획 애니메이션 duration (초) |
| `className` | string | — | 컨테이너에 추가할 CSS 클래스 |
| `onLoaded` | function | — | SVG 로드 완료 콜백 `({ svg, elementCount })` |
| `onDrawStart` | function | — | 드로잉 시작 콜백 `({ elementCount })` |
| `onDrawComplete` | function | — | 드로잉 완료 콜백 `({ elementCount })` |
| `onColorizeStart` | function | — | 채색 시작 콜백 `({ elementCount })` |
| `onColorizeComplete` | function | — | 채색 완료 콜백 `({ elementCount })` |
| `onReady` | function | — | 준비 완료 콜백 `({ svg })` |

## Ref API (useImperativeHandle)

컴포넌트에 `ref`를 연결하면 다음 메서드를 명령형으로 호출할 수 있습니다:

| 메서드 | 설명 |
|--------|------|
| `load(svgString)` | SVG 문자열을 파싱·전처리하여 로드 |
| `play()` | 드로잉 애니메이션 시작 (완료 후 자동 채색) |
| `colorize()` | 채색 애니메이션 단독 실행 |
| `reset()` | 초기 상태(전처리 직후)로 리셋 |

## 이벤트 흐름

```
load()   → onLoaded
play()   → onDrawStart → (각 획 드로잉) → onDrawComplete
         → onColorizeStart → (각 요소 채색) → onColorizeComplete → onReady
```

## 파일 구조

```
src/
  components/
    SvgDrawingPlayground/
      index.jsx                    # 컴포넌트 (forwardRef)
      SvgDrawingPlayground.module.css
  hooks/
    useSvgDrawing.js               # 핵심 드로잉 로직 커스텀 훅
  App.jsx                          # 데모 앱
  App.module.css
  main.jsx
legacy/
  index.html                       # 원본 바닐라 JS 구현
  style.css
  svg-drawing-playground.js
```

## 보안

`load()` 호출 시 SVG 내 `<script>` 태그와 `on*` 이벤트 핸들러 속성을 자동으로 제거합니다 (XSS 방지).
