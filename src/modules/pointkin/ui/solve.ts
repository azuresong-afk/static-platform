/** Решение, чертёж и текст для любого способа задания (общий вход для экрана и проверок). */
import type { Doc } from '../../../shared/doc';
import { renderCamRot, renderCamTrans, renderHarm, renderInteg, renderPath, renderShot } from '../draw/ext';
import { renderComp, renderConv } from '../draw/comp';
import { renderKin, renderUni } from '../draw/kin';
import { solveComp, solveConv } from '../model/comp';
import { solveCamRot, solveCamTrans } from '../model/cam';
import { solveHarm, solveInteg, solvePath, solveShot } from '../model/ext';
import { solveKin, type KinProblem } from '../model/kin';
import { DEF_UNI, solveLin } from '../model/uniform';
import { compDoc, convDoc } from '../text/comp';
import { camRotDoc, camTransDoc } from '../text/cam';
import { harmDoc, integDoc, pathDoc, shotDoc } from '../text/ext';
import { kinDoc } from '../text/solution';
import { uniDoc } from '../text/uniform';

export type Fig = { svg: string; viewBox: string };

export function solveAny(pr: KinProblem, explain: boolean): { fig: Fig; doc: Doc } {
  const ex = { explain };
  switch (pr.mode) {
    case 'uni': {
      const u = pr.uni ?? DEF_UNI;
      const lr = solveLin(u);
      return { fig: renderUni(lr), doc: uniDoc(u, lr, ex) };
    }
    case 'path': {
      const q = solvePath(pr);
      return { fig: renderPath(q), doc: pathDoc(pr, q, ex) };
    }
    case 'integ': {
      const q = solveInteg(pr);
      return { fig: renderInteg(q), doc: integDoc(pr, q, ex) };
    }
    case 'harm': {
      const q = solveHarm(pr);
      return { fig: renderHarm(q), doc: harmDoc(pr, q, ex) };
    }
    case 'shot': {
      const q = solveShot(pr);
      return { fig: renderShot(q), doc: shotDoc(pr, q, ex) };
    }
    case 'comp': {
      const q = solveComp(pr);
      return { fig: renderComp(q), doc: compDoc(pr, q, ex) };
    }
    case 'conv': {
      const q = solveConv(pr);
      return { fig: renderConv(q), doc: convDoc(pr, q, ex) };
    }
    case 'cam': {
      if (pr.p?.kind === 'trans') {
        const q = solveCamTrans(pr);
        return { fig: renderCamTrans(q), doc: camTransDoc(pr, q, ex) };
      }
      const q = solveCamRot(pr);
      return { fig: renderCamRot(q), doc: camRotDoc(pr, q, ex) };
    }
    default: {
      const r = solveKin(pr);
      return { fig: renderKin(pr, r), doc: kinDoc(pr, r, ex) };
    }
  }
}
