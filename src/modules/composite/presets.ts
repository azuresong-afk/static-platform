/**
 * Готовые задачи вкладки «Составное сечение» — схемы задачи 6 Антонова (с. 178–179).
 * Положение части — левый нижний угол габарита, мм; ось симметрии — x = 0.
 */
import type { Part } from './model/section';

const plate = (w: number, h: number, x: number, y: number): Part => ({ kind: 'plate', no: '', w, h, rot: 0, mirror: false, x, y });
const prof = (kind: Part['kind'], no: string, x: number, y: number, rot: Part['rot'] = 0, mirror = false): Part => ({ kind, no, w: 0, h: 0, rot, mirror, x, y });

export const COMPOSITE_PRESETS = {
  s1: { title: 'Антонов, задача 6, схема 1: лист 20×100 и уголки 80×8', parts: [plate(20, 100, -10, 0), prof('angle', '80x8', -90, 20, 180), prof('angle', '80x8', 10, 20, 180, true)] },
  s3: { title: 'Антонов, задача 6, схема 3: два двутавра №16 на листе 180×10', parts: [plate(180, 10, -90, 0), prof('ibeam', '16', -81, 10), prof('ibeam', '16', 0, 10)] },
  s7: { title: 'Антонов, задача 6, схема 7: лист 200×16, двутавр №16, швеллер №14', parts: [plate(200, 16, -100, 0), prof('ibeam', '16', -40.5, 16), prof('channel', '14', -70, 176, 90)] },
  s13: { title: 'Антонов, задача 6, схема 13: двутавр №14, лист 80×10, швеллер №12', parts: [prof('ibeam', '14', -36.5, 0), plate(80, 10, -40, 140), prof('channel', '12', -60, 150, 90)] },
} satisfies Record<string, { title: string; parts: Part[] }>;

export type CompositePresetKey = keyof typeof COMPOSITE_PRESETS;
