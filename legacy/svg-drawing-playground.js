/**
 * SvgDrawingPlayground
 * 인터랙티브 SVG 라이브 드로잉 플레이그라운드
 *
 * 사용법:
 *   const playground = new SvgDrawingPlayground(document.getElementById('container'));
 *   playground.load(svgString);
 *   playground.play();
 *
 * [EXTEND] 이벤트 훅을 통해 외부에서 각 단계별 콜백을 등록할 수 있습니다.
 */
class SvgDrawingPlayground {
  /**
   * @param {HTMLElement} containerEl - SVG를 렌더링할 컨테이너 엘리먼트
   * @param {Object} options - 옵션
   * @param {number} [options.drawStaggerMs=166] - 획 사이 딜레이 (ms)
   * @param {number} [options.colorizeStaggerMs=333] - 채색 사이 딜레이 (ms)
   * @param {number} [options.speedFactor=200] - duration 계산용 속도 인수 (클수록 빠름)
   * @param {number} [options.minDuration=0.3] - 최소 획 애니메이션 duration (초)
   */
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.options = Object.assign({
      drawStaggerMs: 166,       // 초당 6획
      colorizeStaggerMs: 333,   // 채색 스태거
      speedFactor: 200,         // 길이 / speedFactor = duration
      minDuration: 0.3,         // 최소 duration (초)
    }, options);

    // 내부 상태
    this._svgEl = null;         // 현재 로드된 SVG 엘리먼트
    this._elements = [];        // 애니메이션 대상 SVGGeometryElement 배열
    this._listeners = {};       // 이벤트 리스너 맵
    this._isPlaying = false;
    this._timers = [];          // 스케줄된 타이머 ID 목록 (reset 시 취소)
  }

  // ─────────────────────────────────────────────
  // 공개 API
  // ─────────────────────────────────────────────

  /**
   * SVG 문자열을 파싱하고 전처리합니다.
   * @param {string} svgString - 원본 SVG 텍스트
   */
  load(svgString) {
    // 기존 콘텐츠 초기화
    this._clearContainer();

    // XSS 방지: <script> 태그 제거
    const cleanedSvg = this._stripScripts(svgString);

    // DOMParser로 파싱
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanedSvg, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');

    if (!svgEl) {
      console.error('[SvgDrawingPlayground] 유효한 SVG를 찾을 수 없습니다.');
      return;
    }

    // 반응형: width/height 속성 제거 → viewBox만 유지
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.style.width = '100%';
    svgEl.style.height = '100%';

    // DOM에 삽입
    this.container.appendChild(svgEl);
    this._svgEl = svgEl;

    // 애니메이션 전처리
    this._preprocessElements();

    // [EXTEND] 로드 완료 이벤트
    this._emit('loaded', { svg: svgEl, elementCount: this._elements.length });
  }

  /**
   * 드로잉 애니메이션을 시작합니다.
   */
  play() {
    if (!this._svgEl) {
      console.warn('[SvgDrawingPlayground] SVG가 로드되지 않았습니다. load()를 먼저 호출하세요.');
      return;
    }
    if (this._isPlaying) return;

    this._isPlaying = true;

    // [EXTEND] 드로잉 시작 이벤트
    this._emit('draw-start', { elementCount: this._elements.length });

    // 각 요소를 stagger 딜레이로 순차 드로잉
    let drawCompleteCount = 0;
    const total = this._elements.length;

    if (total === 0) {
      // 요소가 없는 경우 즉시 채색 단계로
      this._onDrawComplete();
      return;
    }

    this._elements.forEach((el, index) => {
      const delay = index * this.options.drawStaggerMs;
      const length = this._getLength(el);
      const duration = Math.max(this.options.minDuration, length / this.options.speedFactor);

      const timerId = setTimeout(() => {
        // opacity 표시
        el.style.opacity = '1';

        // stroke-dasharray / stroke-dashoffset 애니메이션 시작
        el.style.transition = `stroke-dashoffset ${duration}s ease`;
        el.style.strokeDashoffset = '0';

        // 드로잉 완료 후 채색 단계 진입 체크
        const drawTimer = setTimeout(() => {
          drawCompleteCount++;
          if (drawCompleteCount === total) {
            this._isPlaying = false;
            // [EXTEND] 드로잉 완료 이벤트
            this._emit('draw-complete', { elementCount: total });
            this._onDrawComplete();
          }
        }, duration * 1000);

        this._timers.push(drawTimer);
      }, delay);

      this._timers.push(timerId);
    });
  }

  /**
   * 원본 fill로 채색 애니메이션을 실행합니다.
   * play() 완료 후 자동 호출되지만, 외부에서 직접 호출도 가능합니다.
   */
  colorize() {
    if (!this._svgEl) return;

    // [EXTEND] 채색 시작 이벤트
    this._emit('colorize-start', { elementCount: this._elements.length });

    let colorizeCompleteCount = 0;
    const total = this._elements.length;

    if (total === 0) {
      this._onColorizeComplete();
      return;
    }

    this._elements.forEach((el, index) => {
      const delay = index * this.options.colorizeStaggerMs;

      const timerId = setTimeout(() => {
        const origFill = el.getAttribute('data-orig-fill');
        const origStroke = el.getAttribute('data-orig-stroke');
        const origStrokeWidth = el.getAttribute('data-orig-stroke-width');

        // fill 복원 (CSS transition으로 부드럽게)
        el.style.transition = 'fill 0.4s ease, stroke 0.4s ease';
        if (origFill && origFill !== 'none') {
          el.style.fill = origFill;
        }
        if (origStroke) {
          el.style.stroke = origStroke;
        }
        if (origStrokeWidth) {
          el.style.strokeWidth = origStrokeWidth;
        }

        colorizeCompleteCount++;
        if (colorizeCompleteCount === total) {
          // 모든 요소 채색 완료 → .is-ready 클래스 추가
          const readyTimer = setTimeout(() => {
            this._svgEl.classList.add('is-ready');
            // [EXTEND] 채색 완료 이벤트
            this._emit('colorize-complete', { elementCount: total });
            // [EXTEND] ready 이벤트 (hover 인터랙션 활성화)
            this._emit('ready', { svg: this._svgEl });
          }, 400); // 마지막 채색 transition 완료 대기

          this._timers.push(readyTimer);
        }
      }, delay);

      this._timers.push(timerId);
    });
  }

  /**
   * SVG를 초기 상태(전처리 직후)로 리셋합니다.
   */
  reset() {
    // 진행 중인 모든 타이머 취소
    this._timers.forEach(id => clearTimeout(id));
    this._timers = [];
    this._isPlaying = false;

    if (!this._svgEl) return;

    // .is-ready 제거
    this._svgEl.classList.remove('is-ready');

    // 각 요소를 초기 상태로 복원
    this._elements.forEach(el => {
      el.style.transition = 'none';
      el.style.opacity = '0';
      el.style.fill = 'none';
      el.style.strokeDashoffset = el.getAttribute('data-orig-length') || '0';
    });
  }

  /**
   * 이벤트 리스너를 등록합니다.
   * @param {string} event - 이벤트명 ('loaded'|'draw-start'|'draw-complete'|'colorize-start'|'colorize-complete'|'ready')
   * @param {Function} handler - 핸들러 함수
   */
  on(event, handler) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(handler);
    return this; // 체이닝 지원
  }

  /**
   * 이벤트 리스너를 제거합니다.
   * @param {string} event - 이벤트명
   * @param {Function} handler - 제거할 핸들러 함수
   */
  off(event, handler) {
    if (!this._listeners[event]) return this;
    this._listeners[event] = this._listeners[event].filter(h => h !== handler);
    return this;
  }

  // ─────────────────────────────────────────────
  // 내부 메서드
  // ─────────────────────────────────────────────

  /**
   * 컨테이너 내용을 비우고 내부 상태를 초기화합니다.
   * @private
   */
  _clearContainer() {
    this.container.innerHTML = '';
    this._svgEl = null;
    this._elements = [];
    this._timers.forEach(id => clearTimeout(id));
    this._timers = [];
    this._isPlaying = false;
  }

  /**
   * SVG 문자열에서 <script> 태그를 모두 제거합니다. (XSS 방지)
   * @param {string} svgString
   * @returns {string}
   * @private
   */
  _stripScripts(svgString) {
    // <script>...</script> 및 on* 이벤트 핸들러 속성 제거
    return svgString
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\s+on\w+="[^"]*"/gi, '')
      .replace(/\s+on\w+='[^']*'/gi, '');
  }

  /**
   * SVG 내 모든 지오메트리 요소를 찾아 애니메이션 전처리를 수행합니다.
   * @private
   */
  _preprocessElements() {
    // 대상 셀렉터: SVGGeometryElement 구현 태그
    const selector = 'path, rect, circle, ellipse, polygon, polyline, line';
    const nodeList = this._svgEl.querySelectorAll(selector);
    this._elements = Array.from(nodeList);

    this._elements.forEach(el => {
      // 원본 스타일 저장
      const origFill = el.getAttribute('fill') || el.style.fill || 'none';
      const origStroke = el.getAttribute('stroke') || el.style.stroke || '#333';
      const origStrokeWidth = el.getAttribute('stroke-width') || el.style.strokeWidth || '1';

      el.setAttribute('data-orig-fill', origFill);
      el.setAttribute('data-orig-stroke', origStroke);
      el.setAttribute('data-orig-stroke-width', origStrokeWidth);

      // 획 길이 측정 (SVGGeometryElement.getTotalLength)
      const length = this._getLength(el);
      el.setAttribute('data-orig-length', length);

      // 드로잉 전 초기 상태 설정
      el.style.fill = 'none';
      el.style.stroke = origStroke !== 'none' ? origStroke : '#333';
      el.style.strokeWidth = origStrokeWidth;
      el.style.opacity = '0';

      // stroke-dasharray/offset으로 "아직 그려지지 않은" 상태 표현
      el.style.strokeDasharray = `${length}`;
      el.style.strokeDashoffset = `${length}`;

      // CSS transition 초기화 (play() 시 재설정)
      el.style.transition = 'none';
    });
  }

  /**
   * SVGGeometryElement의 총 획 길이를 반환합니다.
   * getTotalLength()를 지원하지 않는 요소는 fallback 값을 반환합니다.
   * @param {SVGElement} el
   * @returns {number}
   * @private
   */
  _getLength(el) {
    try {
      if (typeof el.getTotalLength === 'function') {
        return el.getTotalLength();
      }
    } catch (e) {
      // 일부 브라우저에서 rect 등에 getTotalLength 미지원
    }

    // [EXTEND] fallback: 요소 타입별 근사값 계산
    const tag = el.tagName.toLowerCase();
    if (tag === 'rect') {
      const w = parseFloat(el.getAttribute('width') || 0);
      const h = parseFloat(el.getAttribute('height') || 0);
      return 2 * (w + h);
    }
    if (tag === 'circle') {
      const r = parseFloat(el.getAttribute('r') || 0);
      return 2 * Math.PI * r;
    }
    if (tag === 'ellipse') {
      const rx = parseFloat(el.getAttribute('rx') || 0);
      const ry = parseFloat(el.getAttribute('ry') || 0);
      // 타원 둘레 근사 (Ramanujan 공식)
      return Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    }
    if (tag === 'line') {
      const x1 = parseFloat(el.getAttribute('x1') || 0);
      const y1 = parseFloat(el.getAttribute('y1') || 0);
      const x2 = parseFloat(el.getAttribute('x2') || 0);
      const y2 = parseFloat(el.getAttribute('y2') || 0);
      return Math.hypot(x2 - x1, y2 - y1);
    }
    // 기본 fallback
    return 100;
  }

  /**
   * 드로잉 완료 후 채색 단계를 시작합니다.
   * @private
   */
  _onDrawComplete() {
    // 짧은 딜레이 후 채색 시작 (시각적 여운)
    const timerId = setTimeout(() => {
      this.colorize();
    }, 200);
    this._timers.push(timerId);
  }

  /**
   * 채색 완료 처리 (요소가 없는 경우 직접 호출)
   * @private
   */
  _onColorizeComplete() {
    if (this._svgEl) {
      this._svgEl.classList.add('is-ready');
    }
    this._emit('colorize-complete', { elementCount: 0 });
    this._emit('ready', { svg: this._svgEl });
  }

  /**
   * 등록된 이벤트 리스너를 호출합니다.
   * @param {string} event - 이벤트명
   * @param {*} data - 이벤트 데이터
   * @private
   */
  _emit(event, data) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(handler => {
      try {
        handler(data);
      } catch (e) {
        console.error(`[SvgDrawingPlayground] 이벤트 핸들러 오류 (${event}):`, e);
      }
    });
  }
}

// CommonJS / ES Module 환경 모두 지원
// [EXTEND] 번들러 환경에서는 export default SvgDrawingPlayground 사용
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SvgDrawingPlayground;
}
