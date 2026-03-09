import { forwardRef, useImperativeHandle } from 'react';
import { useSvgDrawing } from '../../hooks/useSvgDrawing';
import styles from './SvgDrawingPlayground.module.css';

const SvgDrawingPlayground = forwardRef(function SvgDrawingPlayground(props, ref) {
  const { className, style, ...hookProps } = props;
  const { containerRef, load, play, colorize, reset } = useSvgDrawing(hookProps);
  
  useImperativeHandle(ref, () => ({ load, play, colorize, reset }));
  
  return (
    <div 
      ref={containerRef} 
      className={`${styles.container} ${className || ''}`} 
      style={style}
    />
  );
});

export default SvgDrawingPlayground;
