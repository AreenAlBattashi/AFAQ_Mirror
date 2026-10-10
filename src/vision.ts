import { FilesetResolver, HandLandmarker, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';

type Point = NormalizedLandmark;
type Vision = Awaited<ReturnType<typeof createVision>>;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
let lockedCenter = .5;

export async function createVision() {
  const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
  const common = { runningMode: 'VIDEO' as const };
  const poseOptions = (delegate: 'GPU' | 'CPU') => ({ ...common, baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate }, numPoses: 6, minPoseDetectionConfidence: .42, minPosePresenceConfidence: .42, minTrackingConfidence: .55 });
  // Four hands covers the two closest visitors without classifying every hand in the background.
  const handOptions = (delegate: 'GPU' | 'CPU') => ({ ...common, baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate }, numHands: 4, minHandDetectionConfidence: .42, minHandPresenceConfidence: .42, minTrackingConfidence: .55 });
  const pose = await PoseLandmarker.createFromOptions(files, poseOptions('GPU')).catch(() => PoseLandmarker.createFromOptions(files, poseOptions('CPU')));
  const hands = await HandLandmarker.createFromOptions(files, handOptions('GPU')).catch(() => HandLandmarker.createFromOptions(files, handOptions('CPU')));
  return { pose, hands };
}

export function inspectFrame(video: HTMLVideoElement, vision: Vision, time: number) {
  const poses = vision.pose.detectForVideo(video, time).landmarks;
  const found = vision.hands.detectForVideo(video, time).landmarks;
  const ranked = poses.map(p => {
    const shoulder = distance(p[11], p[12]);
    const torso = distance(p[11], p[23]) + distance(p[12], p[24]);
    const center = (p[11].x + p[12].x + p[23].x + p[24].x) / 4;
    const centrality = 1 - Math.min(.62, Math.abs(center - .5));
    const continuity = 1 - Math.min(.35, Math.abs(center - lockedCenter));
    return { p, center, scale: shoulder, score: (shoulder * 2 + torso * .35) * centrality * continuity };
  }).filter(v => (v.p[11].visibility ?? 0) > .38 && (v.p[12].visibility ?? 0) > .38 && v.scale > .07).sort((a, b) => b.score - a.score);
  const target = ranked[0];
  if (!target) return { present: false, raised: false, bothHands: false, thumbsUp: false, handPresent: false, fingerCount: null, crowded: poses.length > 1 };
  lockedCenter = lockedCenter * .8 + target.center * .2;
  const p = target.p, scale = target.scale;
  const visible = (i: number) => (p[i].visibility ?? 0) > .28;
  const visitorHands = found.filter(h => {
    const nearWrist = [15, 16].some(i => visible(i) && distance(h[0], p[i]) < Math.max(.13, scale * 1.55));
    const insideTorsoLane = Math.abs(h[0].x - target.center) < Math.max(.2, scale * 1.65) && h[0].y < Math.max(p[23].y, p[24].y);
    return nearWrist || insideTorsoLane;
  });
  const armUp = (w: number, s: number, e: number) =>
    (visible(w) && visible(e) && p[w].y < p[s].y + .01 && p[e].y < p[s].y + .13) ||
    visitorHands.some(h => Math.abs(h[0].x - p[s].x) < scale * 1.35 && h[0].y < p[s].y + .01);
  const leftUp = armUp(15, 11, 13), rightUp = armUp(16, 12, 14);
  const gestureHand = visitorHands.sort((a, b) => distance(b[0], b[9]) - distance(a[0], a[9]))[0];
  return { present: true, raised: leftUp || rightUp, bothHands: leftUp && rightUp, thumbsUp: visitorHands.some(isThumbsUp), handPresent: Boolean(gestureHand), fingerCount: gestureHand ? countRaisedFingers(gestureHand) : null, crowded: ranked.length > 1 };
}

// Ignore the thumb so the existing thumbs-up photo gesture cannot mean Day 1.
function countRaisedFingers(h: Point[]) {
  const palm = distance(h[0], h[9]);
  if (palm < .018) return null;
  return [[8, 6], [12, 10], [16, 14], [20, 18]]
    .filter(([tip, pip]) => distance(h[tip], h[0]) > distance(h[pip], h[0]) + palm * .16).length;
}

function isThumbsUp(h: Point[]) {
  const palm = distance(h[0], h[9]);
  if (palm < .018) return false;
  const folded = [[8, 6, 5], [12, 10, 9], [16, 14, 13], [20, 18, 17]]
    .filter(([tip, pip, mcp]) => distance(h[tip], h[mcp]) < distance(h[pip], h[mcp]) + palm * .32).length;
  const thumbRise = h[2].y - h[4].y;
  const thumbClear = Math.min(...[8, 12, 16, 20].map(i => distance(h[4], h[i]))) > palm * .42;
  return folded >= 3 && thumbRise > palm * .3 && distance(h[4], h[2]) > palm * .55 && thumbClear;
}
