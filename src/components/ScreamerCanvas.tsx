import React, { useEffect, useRef } from 'react';

interface ScreamerCanvasProps {
  index: number;
}

export default function ScreamerCanvas({ index }: ScreamerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set resolution to match physical display area
    const updateSize = () => {
      if (canvas) {
        canvas.width = canvas.clientWidth || 800;
        canvas.height = canvas.clientHeight || 600;
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    let animFrame: number;
    let frames = 0;

    const draw = () => {
      frames++;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Random jitter for heavy screen shaking and horror vibration feel
      const shiftX = Math.floor(Math.random() * 16 - 8);
      const shiftY = Math.floor(Math.random() * 16 - 8);

      ctx.save();
      ctx.translate(shiftX, shiftY);

      // Render the specific horrific entity based on index (0-9)
      switch (index) {
        case 0: {
          // -------------------------------------------------------------
          // TYPE 0: THE SMILING DEMON (Deep Crimson Smile)
          // -------------------------------------------------------------
          ctx.fillStyle = '#1e0000';
          ctx.fillRect(-20, -20, w + 40, h + 40);

          // Vignette
          const rad0 = ctx.createRadialGradient(w/2, h/2, w/6, w/2, h/2, w);
          rad0.addColorStop(0, 'rgba(0,0,0,0)');
          rad0.addColorStop(1, 'rgba(0,0,0,0.95)');
          ctx.fillStyle = rad0;
          ctx.fillRect(-20, -20, w + 40, h + 40);

          // Glowing Red Eye sockets
          ctx.fillStyle = '#ff0000';
          ctx.beginPath();
          ctx.arc(w/2 - 80, h/2 - 60, 45, 0, Math.PI * 2);
          ctx.arc(w/2 + 80, h/2 - 60, 45, 0, Math.PI * 2);
          ctx.fill();

          // Tiny intense white pupils
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(w/2 - 80 + Math.sin(frames * 0.5) * 4, h/2 - 60, 6, 0, Math.PI * 2);
          ctx.arc(w/2 + 80 - Math.sin(frames * 0.5) * 4, h/2 - 60, 6, 0, Math.PI * 2);
          ctx.fill();

          // GROTESQUE MASSIVE JAGGED SMILE
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 14;
          ctx.lineCap = 'round';
          ctx.beginPath();
          // Deep curved smile mouth
          ctx.arc(w/2, h/2 + 60, 110, 0.1, Math.PI - 0.1);
          ctx.stroke();

          // Needle-sharp teeth inside mouth
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          // Top teeth array
          for (let tx = -90; tx <= 90; tx += 15) {
            ctx.moveTo(w/2 + tx, h/2 + 65);
            ctx.lineTo(w/2 + tx - 5, h/2 + 95 + Math.random() * 15);
            ctx.lineTo(w/2 + tx - 10, h/2 + 65);
          }
          // Bottom teeth array
          for (let tx = -95; tx <= 95; tx += 15) {
            ctx.moveTo(w/2 + tx, h/2 + 160);
            ctx.lineTo(w/2 + tx - 5, h/2 + 120 - Math.random() * 15);
            ctx.lineTo(w/2 + tx - 10, h/2 + 160);
          }
          ctx.fill();
          break;
        }

        case 1: {
          // -------------------------------------------------------------
          // TYPE 1: SYSTEM_DECAY_01 (Glitched Cyan-Green CRT Grid)
          // -------------------------------------------------------------
          ctx.fillStyle = '#000803';
          ctx.fillRect(-20, -20, w + 40, h + 40);

          // CRT scanlines
          ctx.fillStyle = '#00f288';
          // Draw multiple random horizontal block slices representing visual lag
          for (let i = 0; i < 15; i++) {
            const blockY = Math.floor(Math.sin(frames * 0.2 + i) * h/2 + h/2);
            ctx.fillRect(w/2 - 180 + Math.sin(frames + i) * 15, blockY, 360, 6);
          }

          // Skeletal scan skull
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 4;
          // Outer head shape
          ctx.beginPath();
          ctx.arc(w/2, h/2 - 20, 110, 0, Math.PI * 2);
          ctx.stroke();
          // Nasal cavity
          ctx.fillStyle = '#00e5ff';
          ctx.beginPath();
          ctx.moveTo(w/2, h/2 - 10);
          ctx.lineTo(w/2 - 12, h/2 + 8);
          ctx.lineTo(w/2 + 12, h/2 + 8);
          ctx.closePath();
          ctx.fill();
          
          // Glitched offset code stream text
          ctx.fillStyle = 'rgba(0, 242, 136, 0.45)';
          ctx.font = '11px "JetBrains Mono"';
          ctx.fillText('CRITICAL_MALFUNCTION: DECAY_CORR_SEED', 40, h - 50);
          ctx.fillText(`ANOMALY RESOLVED: 0x${(frames % 255).toString(16).toUpperCase()}`, 40, h - 35);
          ctx.fillText('01100110 01100101 01100001 01110010', 40, h - 20);
          break;
        }

        case 2: {
          // -------------------------------------------------------------
          // TYPE 2: THE WEEPING MOTHER (Charcoal-Style Bleeding Eyes)
          // -------------------------------------------------------------
          ctx.fillStyle = '#080808';
          ctx.fillRect(-20, -20, w + 40, h + 40);

          // Drawing pale ghastly circular white mask
          ctx.fillStyle = '#f0f0f0';
          ctx.beginPath();
          ctx.ellipse(w/2, h/2 - 20, 110, 140, 0, 0, Math.PI * 2);
          ctx.fill();

          // Long bleeding vertical lines
          ctx.fillStyle = '#000000';
          // Left Eye hollow
          ctx.beginPath();
          ctx.arc(w/2 - 45, h/2 - 35, 20, 0, Math.PI * 2);
          ctx.fill();
          // Right Eye hollow
          ctx.beginPath();
          ctx.arc(w/2 + 45, h/2 - 35, 20, 0, Math.PI * 2);
          ctx.fill();

          // Bleeding trails going all the way down
          ctx.fillStyle = '#000000';
          // Left trail
          ctx.fillRect(w/2 - 58, h/2 - 35, 26, h/2 + 200);
          // Right trail
          ctx.fillRect(w/2 + 32, h/2 - 35, 26, h/2 + 200);

          // Deep crying mouth
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(w/2, h/2 + 45, 22, 0, Math.PI, true);
          ctx.stroke();
          break;
        }

        case 3: {
          // -------------------------------------------------------------
          // TYPE 3: VOID ABYSS (Concentric Ring Maw Throat)
          // -------------------------------------------------------------
          ctx.fillStyle = '#010006';
          ctx.fillRect(-20, -20, w + 40, h + 40);

          // Draw neon purple spirals stretching back
          const maxCircles = 12;
          for (let i = 0; i < maxCircles; i++) {
            const radFactor = ((frames * 0.75 + i * 45) % 450);
            const fade = Math.max(0, 1 - radFactor / 450);
            ctx.strokeStyle = `rgba(147, 51, 234, ${fade})`;
            ctx.lineWidth = 8 - (i * 0.5);
            ctx.beginPath();
            ctx.arc(w/2, h/2, radFactor, 0, Math.PI * 2);
            ctx.stroke();

            // Draw tiny nested white teeth on the expanding rings!
            if (i % 2 === 0) {
              ctx.fillStyle = `rgba(255, 255, 255, ${fade * 0.7})`;
              for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
                const tx = w/2 + Math.cos(angle) * radFactor;
                const ty = h/2 + Math.sin(angle) * radFactor;
                ctx.beginPath();
                ctx.arc(tx, ty, 5 + fade * 8, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
          break;
        }

        case 4: {
          // -------------------------------------------------------------
          // TYPE 4: MUTATED WATCHER (Double Stacked Yellow Staring Eyes)
          // -------------------------------------------------------------
          ctx.fillStyle = '#100f07';
          ctx.fillRect(-20, -20, w + 40, h + 40);

          // Pale discolored face skin plate
          ctx.fillStyle = '#423d24';
          ctx.beginPath();
          ctx.ellipse(w/2, h/2, 160, 190, 0, 0, Math.PI * 2);
          ctx.fill();

          // Draw 4 eyes stacking (Left Top, Right Top, Left Bottom, Right Bottom)
          const eyes = [
            { x: w/2 - 60, y: h/2 - 75 },
            { x: w/2 + 60, y: h/2 - 75 },
            { x: w/2 - 55, y: h/2 + 5 },
            { x: w/2 + 55, y: h/2 + 5 }
          ];

          eyes.forEach((eye, idx) => {
            // Sclera
            ctx.fillStyle = '#ffeb3b';
            ctx.beginPath();
            ctx.ellipse(eye.x, eye.y, 35, 24, 0, 0, Math.PI * 2);
            ctx.fill();

            // Veins
            ctx.strokeStyle = '#e91e63';
            ctx.lineWidth = 1;
            for (let v = 0; v < 6; v++) {
              ctx.beginPath();
              ctx.moveTo(eye.x);
              ctx.lineTo(eye.x + (Math.random() * 40 - 20), eye.y + (Math.random() * 20 - 10));
              ctx.stroke();
            }

            // Staring black pupil
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            // Jitter pupils slightly to look extremely psychotic
            const eyeJitterX = Math.sin(frames * 0.4 + idx) * 5;
            ctx.arc(eye.x + eyeJitterX, eye.y, 10, 0, Math.PI * 2);
            ctx.fill();
          });

          // Giant wide flat creepy lip line
          ctx.fillStyle = '#1c0e0b';
          ctx.fillRect(w/2 - 110, h/2 + 75, 220, 8);
          break;
        }

        case 5: {
          // -------------------------------------------------------------
          // TYPE 5: STRETCHED GHOST IN STATIC (High-contrast retro noise phantom)
          // -------------------------------------------------------------
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, w, h);

          // Fast procedural static pixels
          for (let pIdx = 0; pIdx < 300; pIdx++) {
            const rx = Math.random() * w;
            const ry = Math.random() * h;
            const rw = Math.random() * 80 + 30;
            const rc = Math.floor(Math.random() * 120 + 80);
            ctx.fillStyle = `rgb(${rc}, ${rc}, ${rc})`;
            ctx.fillRect(rx, ry, rw, 1.5);
          }

          // Overlay a terrifying extremely elongated spectral white face
          ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
          ctx.beginPath();
          // Elongated egg shape
          ctx.ellipse(w/2, h/2 - 30, 95, 175, 0, 0, Math.PI * 2);
          ctx.fill();

          // Long empty hollow black eye stripes
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.ellipse(w/2 - 35, h/2 - 70, 14, 45, 0, 0, Math.PI * 2);
          ctx.ellipse(w/2 + 35, h/2 - 70, 14, 45, 0, 0, Math.PI * 2);
          ctx.fill();

          // Unnaturally long black agape hole mouth
          ctx.beginPath();
          ctx.ellipse(w/2, h/2 + 50, 22, 75, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 6: {
          // -------------------------------------------------------------
          // TYPE 6: SLIT JAW DISLOCATION (Putrid mold green asymmetrical jaw)
          // -------------------------------------------------------------
          ctx.fillStyle = '#031405';
          ctx.fillRect(-20, -20, w + 40, h + 40);

          // Head outline
          ctx.fillStyle = '#3a8044';
          ctx.beginPath();
          ctx.ellipse(w/2, h/2 - 40, 120, 130, 0, 0, Math.PI * 2);
          ctx.fill();

          // Slanted hollow white eyes
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(w/2 - 65, h/2 - 70);
          ctx.lineTo(w/2 - 25, h/2 - 50);
          ctx.lineTo(w/2 - 65, h/2 - 45);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(w/2 + 65, h/2 - 70);
          ctx.lineTo(w/2 + 25, h/2 - 50);
          ctx.lineTo(w/2 + 65, h/2 - 45);
          ctx.closePath();
          ctx.fill();

          // Bleeding eyes details
          ctx.fillStyle = '#ff0000';
          ctx.beginPath();
          ctx.arc(w/2 - 45, h/2 - 55, 3, 0, Math.PI * 2);
          ctx.arc(w/2 + 45, h/2 - 55, 3, 0, Math.PI * 2);
          ctx.fill();

          // Crudely displaced sliced jaw sitting far left downwards in deep black/red
          ctx.fillStyle = '#1c0303';
          ctx.beginPath();
          ctx.ellipse(w/2 - 35, h/2 + 65, 80, 75, -0.4, 0, Math.PI * 2);
          ctx.fill();

          // Add toxic yellow-white row of shattered jagged teeth hanging
          ctx.fillStyle = '#fefefe';
          for (let tx = -40; tx < 40; tx += 12) {
            ctx.beginPath();
            ctx.moveTo(w/2 - 35 + tx, h/2 + 35);
            ctx.lineTo(w/2 - 35 + tx + 5, h/2 + 55 + Math.random() * 15);
            ctx.lineTo(w/2 - 35 + tx + 10, h/2 + 35);
            ctx.closePath();
            ctx.fill();
          }
          break;
        }

        case 7: {
          // -------------------------------------------------------------
          // TYPE 7: STITCHED SILENCE (Flesh leather stitched eyes & mask)
          // -------------------------------------------------------------
          ctx.fillStyle = '#1e140a';
          ctx.fillRect(-20, -20, w + 40, h + 40);

          // Leather mask face
          ctx.fillStyle = '#8d5524';
          ctx.beginPath();
          ctx.ellipse(w/2, h/2, 140, 170, 0, 0, Math.PI * 2);
          ctx.fill();

          // No real features: draw crude dark stitching marks over eyes and mouth coordinates
          ctx.strokeStyle = '#0a0502';
          ctx.lineWidth = 4;

          const drawStitchLine = (cx: number, cy: number, length: number) => {
            // Draw baseline
            ctx.beginPath();
            ctx.moveTo(cx - length/2, cy);
            ctx.lineTo(cx + length/2, cy);
            ctx.stroke();

            // Draw crossing stitches (X shapes)
            ctx.strokeStyle = '#2d180b';
            ctx.lineWidth = 3;
            for (let offset = -length/2; offset <= length/2; offset += length/5) {
              ctx.beginPath();
              ctx.moveTo(cx + offset - 8, cy - 12);
              ctx.lineTo(cx + offset + 8, cy + 12);
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(cx + offset + 8, cy - 12);
              ctx.lineTo(cx + offset - 8, cy + 12);
              ctx.stroke();
            }
          };

          // Stitch left eye shut
          drawStitchLine(w/2 - 50, h/2 - 35, 60);
          // Stitch right eye shut
          drawStitchLine(w/2 + 50, h/2 - 35, 60);
          // Stitch mouth shut
          drawStitchLine(w/2, h/2 + 60, 110);

          // Dark rust blood leaking down from stitches
          ctx.fillStyle = '#4a0800';
          ctx.fillRect(w/2 - 55, h/2 - 30, 8, 45);
          ctx.fillRect(w/2 + 45, h/2 - 30, 8, 45);
          ctx.fillRect(w/2 - 20, h/2 + 65, 12, 60);
          break;
        }

        case 8: {
          // -------------------------------------------------------------
          // TYPE 8: CRACKED PORCELAIN COGNITION (Eerie Doll face)
          // -------------------------------------------------------------
          ctx.fillStyle = '#0d0d0e';
          ctx.fillRect(-20, -20, w + 40, h + 40);

          // Pure white shiny plate
          ctx.fillStyle = '#faf0e6';
          ctx.beginPath();
          ctx.ellipse(w/2, h/2 - 10, 115, 135, 0, 0, Math.PI * 2);
          ctx.fill();

          // Blue staring right eyeball (left is empty and cracked)
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(w/2 + 40, h/2 - 30, 20, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#00bcd4';
          ctx.beginPath();
          ctx.arc(w/2 + 40, h/2 - 30, 9, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(w/2 + 40, h/2 - 30, 4, 0, Math.PI * 2);
          ctx.fill();

          // Empty shattered pitch black left socket leaking black oil
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(w/2 - 40, h/2 - 30, 24, 0, Math.PI * 2);
          ctx.fill();

          // Black stream
          ctx.fillRect(w/2 - 45, h/2 - 30, 10, h/2);

          // Giant cracks drawn all over left cheek
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(w/2 - 40, h/2 - 10);
          ctx.lineTo(w/2 - 75, h/2 + 15);
          ctx.lineTo(w/2 - 50, h/2 + 45);
          ctx.lineTo(w/2 - 95, h/2 + 65);
          ctx.stroke();

          // Little pink rosy lips that look completely disconnected/unsettling
          ctx.fillStyle = '#ff4081';
          ctx.beginPath();
          ctx.ellipse(w/2, h/2 + 55, 25, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 9: {
          // -------------------------------------------------------------
          // TYPE 9: RED RETINAL SURVEILLANCE FEED (Dystopian Skull)
          // -------------------------------------------------------------
          ctx.fillStyle = '#0a0002';
          ctx.fillRect(-20, -20, w + 40, h + 40);

          // Retinal vector target grid lines
          ctx.strokeStyle = 'rgba(255, 0, 40, 0.25)';
          ctx.lineWidth = 1;
          for (let gy = 0; gy < h; gy += 40) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(w, gy);
            ctx.stroke();
          }

          // Central circular crosshair analysis ring
          ctx.strokeStyle = '#ff0033';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(w/2, h/2, 180 + Math.sin(frames * 0.1) * 12, 0, Math.PI * 2);
          ctx.stroke();

          // Huge glowing red vector cyber-skull
          ctx.strokeStyle = '#ff0033';
          ctx.lineWidth = 3.5;

          // Drawing vector skull outline coordinates
          ctx.beginPath();
          // Crown
          ctx.arc(w/2, h/2 - 40, 95, Math.PI, 0, false);
          // Jaw lines
          ctx.lineTo(w/2 + 95, h/2 + 50);
          ctx.lineTo(w/2 + 55, h/2 + 110);
          ctx.lineTo(w/2 - 55, h/2 + 110);
          ctx.lineTo(w/2 - 95, h/2 + 50);
          ctx.closePath();
          ctx.stroke();

          // Empty triangle nasal vector
          ctx.beginPath();
          ctx.moveTo(w/2, h/2 - 10);
          ctx.lineTo(w/2 - 15, h/2 + 15);
          ctx.lineTo(w/2 + 15, h/2 + 15);
          ctx.closePath();
          ctx.stroke();

          // Empty vector eyes
          ctx.beginPath();
          ctx.arc(w/2 - 40, h/2 - 30, 22, 0, Math.PI * 2);
          ctx.arc(w/2 + 40, h/2 - 30, 22, 0, Math.PI * 2);
          ctx.stroke();

          // Target Locked indicator blinking on top
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px "JetBrains Mono"';
          if (frames % 20 < 10) {
            ctx.fillText('SUBJECT IDENTIFIED - HEART RATE: 0.00', w/2 - 140, h/2 - 130);
          }
          break;
        }

        default:
          break;
      }

      ctx.restore();

      // Intermittent digital glitch bar slice noise on top of any screamer
      if (Math.random() > 0.88) {
        ctx.fillStyle = `rgba(${(index % 2 === 0) ? '255, 0, 0' : '255, 255, 255'}, 0.25)`;
        ctx.fillRect(0, Math.random() * h, w, Math.random() * 45);
      }

      animFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', updateSize);
    };
  }, [index]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full bg-black block z-50 pointer-events-none"
    />
  );
}
