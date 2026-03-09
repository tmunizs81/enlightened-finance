import { useCallback, useRef } from "react";
import confetti from "canvas-confetti";

export function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fire = useCallback((options?: { particleCount?: number; spread?: number; origin?: { x: number; y: number } }) => {
    confetti({
      particleCount: options?.particleCount || 100,
      spread: options?.spread || 70,
      origin: options?.origin || { y: 0.6 },
      colors: ["#2dd4bf", "#a78bfa", "#34d399", "#fbbf24", "#f472b6"],
    });
  }, []);

  const fireStars = useCallback(() => {
    const defaults = { spread: 360, ticks: 50, gravity: 0, decay: 0.94, startVelocity: 30, colors: ["#2dd4bf", "#a78bfa", "#34d399", "#fbbf24"] };
    confetti({ ...defaults, particleCount: 40, scalar: 1.2, shapes: ["star"] });
    confetti({ ...defaults, particleCount: 20, scalar: 0.75, shapes: ["circle"] });
  }, []);

  const fireCanon = useCallback(() => {
    const end = Date.now() + 1500;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#2dd4bf", "#a78bfa"] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#34d399", "#fbbf24"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  return { fire, fireStars, fireCanon };
}
