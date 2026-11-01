const clamp = (value: number) => Math.max(0, Math.min(1, value));

const flights = [
  { delay: 0, duration: .72, direction: -1, tilt: -3 },
  { delay: .1, duration: .66, direction: 1, tilt: 3 },
  { delay: .04, duration: .8, direction: 1, tilt: 2 },
  { delay: .18, duration: .7, direction: -1, tilt: -2 },
] as const;

// A full front → edge → back → edge → front tumble, sampled directly from scroll.
// The final 12% is a readable hold; there is no clock or easing loop to catch up.
export function comfortPose(progress: number, index: number, compact = false) {
  const flight = flights[index % flights.length]!;
  const phase = clamp((progress - flight.delay) / flight.duration);
  const remaining = 1 - phase;
  const arc = phase === 1 ? 0 : Math.sin(phase * Math.PI);
  const side = index % 2 === 0 ? -1 : 1;

  return {
    x: side * arc * (compact ? 3 : 22),
    y: -remaining * (compact ? 18 : 42),
    z: -remaining * 150 - arc * 45,
    rotateX: flight.direction * arc * 42,
    rotateY: flight.direction * remaining * 360,
    rotateZ: flight.tilt + flight.direction * (remaining * 14 + arc * 10) * (compact ? .65 : 1),
  };
}

export function comfortTransform(progress: number, index: number, compact = false) {
  const pose = comfortPose(progress, index, compact);
  return `translate3d(${pose.x}px, ${pose.y}px, ${pose.z}px) rotateZ(${pose.rotateZ}deg) rotateY(${pose.rotateY}deg) rotateX(${pose.rotateX}deg)`;
}
