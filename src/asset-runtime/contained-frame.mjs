export function computeContainedFrame(sourceFrame, targetFrame) {
  const scale = Math.min(
    targetFrame.width / sourceFrame.width,
    targetFrame.height / sourceFrame.height,
  );
  const width = sourceFrame.width * scale;
  const height = sourceFrame.height * scale;
  return {
    left: targetFrame.left + (targetFrame.width - width) / 2,
    top: targetFrame.top + (targetFrame.height - height) / 2,
    width,
    height,
    scale,
  };
}

export function transformPositionInContainedFrame(position, sourceFrame, targetFrame) {
  const fittedFrame = computeContainedFrame(sourceFrame, targetFrame);
  return {
    ...position,
    left: fittedFrame.left + (position.left - sourceFrame.left) * fittedFrame.scale,
    top: fittedFrame.top + (position.top - sourceFrame.top) * fittedFrame.scale,
    width: position.width * fittedFrame.scale,
    height: position.height * fittedFrame.scale,
  };
}
