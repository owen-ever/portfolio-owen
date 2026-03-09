import { useRef, useEffect, useCallback } from 'react';

export function useSvgDrawing(options = {}) {
  const containerRef = useRef(null);
  const stateRef = useRef({
    svgEl: null,
    elements: [],
    isPlaying: false,
    timers: []
  });

  const mergedOptions = {
    drawStaggerMs: 166,
    colorizeStaggerMs: 333,
    speedFactor: 200,
    minDuration: 0.3,
    ...options
  };

  const {
    onLoaded,
    onDrawStart,
    onDrawComplete,
    onColorizeStart,
    onColorizeComplete,
    onReady
  } = options;

  const emit = useCallback((eventName, data) => {
    switch (eventName) {
      case 'loaded': onLoaded?.(data); break;
      case 'draw-start': onDrawStart?.(data); break;
      case 'draw-complete': onDrawComplete?.(data); break;
      case 'colorize-start': onColorizeStart?.(data); break;
      case 'colorize-complete': onColorizeComplete?.(data); break;
      case 'ready': onReady?.(data); break;
    }
  }, [onLoaded, onDrawStart, onDrawComplete, onColorizeStart, onColorizeComplete, onReady]);

  const clearTimers = useCallback(() => {
    stateRef.current.timers.forEach(id => clearTimeout(id));
    stateRef.current.timers = [];
  }, []);

  const clearContainer = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    stateRef.current.svgEl = null;
    stateRef.current.elements = [];
    clearTimers();
    stateRef.current.isPlaying = false;
  }, [clearTimers]);

  const stripScripts = useCallback((svgString) => {
    return svgString
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\s+on\w+="[^"]*"/gi, '')
      .replace(/\s+on\w+='[^']*'/gi, '');
  }, []);

  const getLength = useCallback((el) => {
    try {
      if (typeof el.getTotalLength === 'function') return el.getTotalLength();
    } catch (e) {}
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
      return Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    }
    if (tag === 'line') {
      const x1 = parseFloat(el.getAttribute('x1') || 0);
      const y1 = parseFloat(el.getAttribute('y1') || 0);
      const x2 = parseFloat(el.getAttribute('x2') || 0);
      const y2 = parseFloat(el.getAttribute('y2') || 0);
      return Math.hypot(x2 - x1, y2 - y1);
    }
    return 100;
  }, []);

  const preprocessElements = useCallback(() => {
    const { svgEl } = stateRef.current;
    if (!svgEl) return;
    const selector = 'path, rect, circle, ellipse, polygon, polyline, line';
    const nodeList = svgEl.querySelectorAll(selector);
    const elements = Array.from(nodeList);
    stateRef.current.elements = elements;

    elements.forEach(el => {
      const origFill = el.getAttribute('fill') || el.style.fill || 'none';
      const origStroke = el.getAttribute('stroke') || el.style.stroke || '#333';
      const origStrokeWidth = el.getAttribute('stroke-width') || el.style.strokeWidth || '1';
      el.setAttribute('data-orig-fill', origFill);
      el.setAttribute('data-orig-stroke', origStroke);
      el.setAttribute('data-orig-stroke-width', origStrokeWidth);
      const length = getLength(el);
      el.setAttribute('data-orig-length', length);
      el.style.fill = 'none';
      el.style.stroke = origStroke !== 'none' ? origStroke : '#333';
      el.style.strokeWidth = origStrokeWidth;
      el.style.opacity = '0';
      el.style.strokeDasharray = `${length}`;
      el.style.strokeDashoffset = `${length}`;
      el.style.transition = 'none';
    });
  }, [getLength]);

  const load = useCallback((svgString) => {
    clearContainer();
    if (!containerRef.current) return;

    const cleanedSvg = stripScripts(svgString);
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanedSvg, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) {
      console.error('[SvgDrawingPlayground] 유효한 SVG를 찾을 수 없습니다.');
      return;
    }
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.style.width = '100%';
    svgEl.style.height = '100%';
    containerRef.current.appendChild(svgEl);
    stateRef.current.svgEl = svgEl;
    preprocessElements();
    emit('loaded', { svg: svgEl, elementCount: stateRef.current.elements.length });
  }, [clearContainer, stripScripts, preprocessElements, emit]);

  const colorize = useCallback(() => {
    const { svgEl, elements, timers } = stateRef.current;
    if (!svgEl) return;
    emit('colorize-start', { elementCount: elements.length });
    let colorizeCompleteCount = 0;
    const total = elements.length;
    if (total === 0) {
      if (svgEl) svgEl.classList.add('is-ready');
      emit('colorize-complete', { elementCount: 0 });
      emit('ready', { svg: svgEl });
      return;
    }

    elements.forEach((el, index) => {
      const delay = index * mergedOptions.colorizeStaggerMs;
      const timerId = setTimeout(() => {
        const origFill = el.getAttribute('data-orig-fill');
        const origStroke = el.getAttribute('data-orig-stroke');
        const origStrokeWidth = el.getAttribute('data-orig-stroke-width');
        el.style.transition = 'fill 0.4s ease, stroke 0.4s ease';
        if (origFill && origFill !== 'none') { el.style.fill = origFill; }
        if (origStroke) { el.style.stroke = origStroke; }
        if (origStrokeWidth) { el.style.strokeWidth = origStrokeWidth; }
        
        colorizeCompleteCount++;
        if (colorizeCompleteCount === total) {
          const readyTimer = setTimeout(() => {
            if (stateRef.current.svgEl) stateRef.current.svgEl.classList.add('is-ready');
            emit('colorize-complete', { elementCount: total });
            emit('ready', { svg: stateRef.current.svgEl });
          }, 400);
          timers.push(readyTimer);
        }
      }, delay);
      timers.push(timerId);
    });
  }, [emit, mergedOptions.colorizeStaggerMs]);

  const play = useCallback(() => {
    const { svgEl, elements, isPlaying, timers } = stateRef.current;
    if (!svgEl) {
      console.warn('[SvgDrawingPlayground] SVG가 로드되지 않았습니다.');
      return;
    }
    if (isPlaying) return;
    stateRef.current.isPlaying = true;
    emit('draw-start', { elementCount: elements.length });
    
    let drawCompleteCount = 0;
    const total = elements.length;
    if (total === 0) {
      const timerId = setTimeout(() => { colorize(); }, 200);
      timers.push(timerId);
      return;
    }

    elements.forEach((el, index) => {
      const delay = index * mergedOptions.drawStaggerMs;
      const length = getLength(el);
      const duration = Math.max(mergedOptions.minDuration, length / mergedOptions.speedFactor);
      
      const timerId = setTimeout(() => {
        el.style.opacity = '1';
        el.style.transition = `stroke-dashoffset ${duration}s ease`;
        el.style.strokeDashoffset = '0';
        
        const drawTimer = setTimeout(() => {
          drawCompleteCount++;
          if (drawCompleteCount === total) {
            stateRef.current.isPlaying = false;
            emit('draw-complete', { elementCount: total });
            const nextTimer = setTimeout(() => { colorize(); }, 200);
            stateRef.current.timers.push(nextTimer);
          }
        }, duration * 1000);
        timers.push(drawTimer);
      }, delay);
      timers.push(timerId);
    });
  }, [emit, getLength, mergedOptions.drawStaggerMs, mergedOptions.minDuration, mergedOptions.speedFactor, colorize]);

  const reset = useCallback(() => {
    clearTimers();
    stateRef.current.isPlaying = false;
    const { svgEl, elements } = stateRef.current;
    if (!svgEl) return;
    svgEl.classList.remove('is-ready');
    elements.forEach(el => {
      el.style.transition = 'none';
      el.style.opacity = '0';
      el.style.fill = 'none';
      el.style.strokeDashoffset = el.getAttribute('data-orig-length') || '0';
    });
  }, [clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return { containerRef, load, play, colorize, reset };
}
