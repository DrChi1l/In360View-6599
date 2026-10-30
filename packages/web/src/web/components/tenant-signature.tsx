import { useEffect, useRef } from "react";
import { Button } from "./ui/button";

export function TenantSignature({
  onChange,
  disabled,
}: {
  onChange: (blob: Blob | null) => void;
  disabled: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    node.width = 900;
    node.height = 260;
    const ctx = node.getContext("2d");
    if (ctx) {
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#12065C";
    }
  }, []);
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * 900) / r.width, y: ((e.clientY - r.top) * 260) / r.height };
  };
  const finish = () => {
    if (drawing.current) {
      drawing.current = false;
      canvas.current?.toBlob(onChange, "image/png");
    }
  };
  return (
    <div>
      <canvas
        ref={canvas}
        aria-label="Draw your signature"
        className="h-36 w-full touch-none rounded-xl border border-dashed border-brand-500 bg-white"
        onPointerDown={(e) => {
          if (disabled) return;
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext("2d");
          const p = point(e);
          ctx?.beginPath();
          ctx?.moveTo(p.x, p.y);
          ctx?.lineTo(p.x + 0.1, p.y + 0.1);
          ctx?.stroke();
        }}
        onPointerMove={(e) => {
          if (drawing.current) {
            const p = point(e);
            const ctx = e.currentTarget.getContext("2d");
            ctx?.lineTo(p.x, p.y);
            ctx?.stroke();
          }
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        disabled={disabled}
        onClick={() => {
          canvas.current?.getContext("2d")?.clearRect(0, 0, 900, 260);
          onChange(null);
        }}
      >
        Clear signature
      </Button>
    </div>
  );
}
