import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Container3 from "../Container3/Container3";
import s from "./TheoryHome.module.css";

const defaultCalcState = { result: "Результат", error: false };

export default function Theory() {
  const [inv, setInv] = useState({ E1: "", p1: "", E2: "", p2: "", angle: "", ...defaultCalcState });
  const [lumi, setLumi] = useState({ sigma: "", L: "", ...defaultCalcState });
  const [lorentz, setLorentz] = useState({ mode: "beta", val1: "", val2: "", ...defaultCalcState });
  const [rap, setRap] = useState({ theta: "", E: "", pz: "", ...defaultCalcState });
  const [bind, setBind] = useState({ Z: "", A: "", ...defaultCalcState });
  const [pt, setPt] = useState({ p: "", theta: "", ...defaultCalcState });

  const setResult = (setter, result, error = false) => {
    setter((prev) => ({ ...prev, result, error }));
  };

  const calcInv = () => {
    const E1 = parseFloat(inv.E1);
    const p1 = parseFloat(inv.p1);
    const E2 = parseFloat(inv.E2);
    const p2 = parseFloat(inv.p2);
    const angle = parseFloat(inv.angle) * Math.PI / 180;
    if ([E1, p1, E2, p2, angle].some((v) => Number.isNaN(v))) {
      return setResult(setInv, "Заполните все поля", true);
    }
    const Etot = E1 + E2;
    const p_sq = p1 * p1 + p2 * p2 + 2 * p1 * p2 * Math.cos(angle);
    const M2 = Etot * Etot - p_sq;
    if (M2 < 0) return setResult(setInv, "M^2 < 0 — проверьте ввод (E < |p|)", true);
    const M = Math.sqrt(M2);
    return setResult(setInv, `M = ${M.toFixed(4)} ГэВ/c^2`);
  };

  const calcLumi = () => {
    const sigma = parseFloat(lumi.sigma);
    const L = parseFloat(lumi.L);
    if ([sigma, L].some((v) => Number.isNaN(v))) return setResult(setLumi, "Заполните оба поля", true);
    const Lpb = L * 1000;
    const N = sigma * Lpb;
    const str = `N = ${N.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} событий`;
    return setResult(setLumi, str);
  };

  const calcLorentz = () => {
    const v1 = parseFloat(lorentz.val1);
    if (Number.isNaN(v1)) return setResult(setLorentz, "Введите значение", true);
    if (lorentz.mode === "beta") {
      const beta = v1;
      if (beta <= 0 || beta >= 1) return setResult(setLorentz, "β должно быть в (0, 1)", true);
      const gamma = 1 / Math.sqrt(1 - beta * beta);
      return setResult(setLorentz, `γ = ${gamma.toFixed(4)} | β = ${beta.toFixed(6)}`);
    }
    const m = parseFloat(lorentz.val2);
    if (Number.isNaN(m) || m <= 0) return setResult(setLorentz, "Введите массу > 0", true);
    const gamma = v1 / m;
    const beta = Math.sqrt(1 - 1 / (gamma * gamma));
    return setResult(setLorentz, `γ = ${gamma.toFixed(4)} | β = ${beta.toFixed(6)}`);
  };

  const calcRapidity = () => {
    const thetaDeg = parseFloat(rap.theta);
    if (Number.isNaN(thetaDeg)) return setResult(setRap, "Введите угол θ", true);
    const theta = thetaDeg * Math.PI / 180;
    if (theta <= 0 || theta >= Math.PI) return setResult(setRap, "θ должен быть в (0°, 180°)", true);
    const eta = -Math.log(Math.tan(theta / 2));
    let str = `η = ${eta.toFixed(4)}`;
    const E = parseFloat(rap.E);
    const pz = parseFloat(rap.pz);
    if (!Number.isNaN(E) && !Number.isNaN(pz)) {
      if (E <= Math.abs(pz)) return setResult(setRap, "E должно быть > |p_z|", true);
      const y = 0.5 * Math.log((E + pz) / (E - pz));
      str += ` | y = ${y.toFixed(4)}`;
    }
    return setResult(setRap, str);
  };

  const calcBinding = () => {
    const Z = parseInt(bind.Z, 10);
    const A = parseInt(bind.A, 10);
    if (Number.isNaN(Z) || Number.isNaN(A) || Z < 1 || A < 1 || Z > A) {
      return setResult(setBind, "Проверьте Z и A (Z ≤ A)", true);
    }
    const N = A - Z;
    const av = 15.56, as = 17.23, ac = 0.697, aa = 23.285;
    let delta = 0;
    if (Z % 2 === 0 && N % 2 === 0) delta = 12 / Math.sqrt(A);
    else if (Z % 2 === 1 && N % 2 === 1) delta = -12 / Math.sqrt(A);
    const B = av * A - as * Math.pow(A, 2 / 3) - ac * Z * (Z - 1) / Math.pow(A, 1 / 3) - aa * Math.pow(A - 2 * Z, 2) / A + delta;
    const per = B / A;
    return setResult(setBind, `B = ${B.toFixed(2)} МэВ | B/A = ${per.toFixed(3)} МэВ/нуклон`);
  };

  const calcPt = () => {
    const p = parseFloat(pt.p);
    const thetaDeg = parseFloat(pt.theta);
    if (Number.isNaN(p) || Number.isNaN(thetaDeg)) return setResult(setPt, "Заполните оба поля", true);
    const theta = thetaDeg * Math.PI / 180;
    const ptVal = p * Math.sin(theta);
    const pz = p * Math.cos(theta);
    return setResult(setPt, `p_T = ${ptVal.toFixed(4)} ГэВ/c | p_z = ${pz.toFixed(4)} ГэВ/c`);
  };

  return (
    <div className={s.theoryHome}>
      <Container3>
        <section className={s.hero}>
          <h1 className={s.heroTitle}>База знаний</h1>
          <p className={s.heroSubtitle}>Устройство и работа квантового мира</p>
        </section>

        <section className={s.cards}>
          <Link className={s.cardLink} to="/theory/particles">
            <div className={s.cardBox}>
              <div className={s.cardImage} />
              <p className={s.cardTitle}>Теория элементарных частиц</p>
            </div>
          </Link>
          <Link className={s.cardLink} to="/theory/lhc">
            <div className={s.cardBox}>
              <div className={s.cardImage} />
              <p className={s.cardTitle}>Большой адронный коллайдер</p>
            </div>
          </Link>
          <Link className={s.cardLink} to="/theory/simulation">
            <div className={s.cardBox}>
              <div className={s.cardImage} />
              <p className={s.cardTitle}>Как работает наша симуляция</p>
            </div>
          </Link>
        </section>
      </Container3>

      <section className={s.calcsWrap}>
        <Container3>
          <h2 className={s.calcsTitle}>Интерактивные расчеты</h2>
          <p className={s.calcsSubtitle}>Калькуляторы для ключевых величин, которые рассчитываются при анализе столкновений на БАК.</p>

          <div className={s.calcsGrid}>
            <div className={`${s.calcCard} ${s.calcCardLarge}`}>
              <div className={s.calcHeader}>
                <div className={s.calcHeaderTitle}>Инвариантная масса</div>
                <div className={s.calcHeaderSubtitle}>Масса системы двух частиц</div>
              </div>
              <div className={s.calcBody}>
                <div className={s.calcInfo}>
                  Инвариантная масса — лоренц-инвариантная величина, определяющая массу системы частиц. Это ключевой параметр при поиске резонансов (новых частиц) на коллайдере: пик в распределении инвариантной массы указывает на рождение промежуточной частицы.
                  <div className={s.calcInfoFormula}>
                    M<sup>2</sup> = (E<sub>1</sub> + E<sub>2</sub>)<sup>2</sup> - |p<sub>1</sub> + p<sub>2</sub>|<sup>2</sup>
                  </div>
                  Здесь E — полная энергия частицы, p⃗ — её 3-импульс. В системе единиц c = 1. Если частицы летят навстречу друг другу (как на БАК), инвариантная масса максимальна.
                </div>

                <div className={s.calcInputs}>
                  <label>
                    <div className={s.calcLabel}>E<sub>1</sub> (GeV)</div>
                    <input className={s.calcInput} value={inv.E1} onChange={(e) => setInv({ ...inv, E1: e.target.value })} />
                  </label>
                  <label>
                    <div className={s.calcLabel}>|p<sub>1</sub>| (GeV/c)</div>
                    <input className={s.calcInput} value={inv.p1} onChange={(e) => setInv({ ...inv, p1: e.target.value })} />
                  </label>
                  <label>
                    <div className={s.calcLabel}>E<sub>2</sub> (GeV)</div>
                    <input className={s.calcInput} value={inv.E2} onChange={(e) => setInv({ ...inv, E2: e.target.value })} />
                  </label>
                  <label>
                    <div className={s.calcLabel}>|p<sub>2</sub>| (GeV/c)</div>
                    <input className={s.calcInput} value={inv.p2} onChange={(e) => setInv({ ...inv, p2: e.target.value })} />
                  </label>
                  <label className={s.calcInputFull}>
                    <div className={s.calcLabel}>Угол между p<sub>1</sub> и p<sub>2</sub></div>
                    <input className={s.calcInput} value={inv.angle} onChange={(e) => setInv({ ...inv, angle: e.target.value })} />
                  </label>
                </div>

                <button className={s.calcButton} type="button" onClick={calcInv}>Рассчитать</button>
                <div className={`${s.calcResult} ${inv.error ? s.calcResultError : ""}`}>{inv.result}</div>
              </div>
            </div>

            <div className={`${s.calcCard} ${s.calcCardMedium}`}>
              <div className={s.calcHeader}>
                <div className={s.calcHeaderTitle}>Светимость событий</div>
                <div className={s.calcHeaderSubtitle}>Частота взаимодействий</div>
              </div>
              <div className={s.calcBody}>
                <div className={s.calcInfo}>
                  Светимость L коллайдера определяет, сколько столкновений в секунду происходит.

                  Сечение σ (в барнах, 1б = 10⁻²⁴ см²) — эффективная «площадь мишени» для данного процесса. Число ожидаемых событий N = σ × L. Чтобы открыть бозон Хиггса (σ ≈ 50 пб на 13 ТэВ), нужна интегральная светимость ~100 фб⁻¹. На БАК пиковая мгновенная светимость: L ≈ 2 × 10³⁴ см⁻²с⁻¹.
                  <div className={s.calcInfoFormula}>N = σ · L dt</div>
                  1 фб<sup>-1</sup> = 10<sup>39</sup> см<sup>-2</sup>. 1 пб = 10<sup>-36</sup> см<sup>2</sup>.
                </div>
                <div className={s.calcInputs}>
                  <label>
                    <div className={s.calcLabel}>Сечение σ (пб)</div>
                    <input className={s.calcInput} value={lumi.sigma} onChange={(e) => setLumi({ ...lumi, sigma: e.target.value })} />
                  </label>
                  <label>
                    <div className={s.calcLabel}>Инт. светимость (фб<sup>-1</sup>)</div>
                    <input className={s.calcInput} value={lumi.L} onChange={(e) => setLumi({ ...lumi, L: e.target.value })} />
                  </label>
                </div>
                <button className={s.calcButton} type="button" onClick={calcLumi}>Рассчитать</button>
                <div className={`${s.calcResult} ${lumi.error ? s.calcResultError : ""}`}>{lumi.result}</div>
              </div>
            </div>

            <div className={`${s.calcCard} ${s.calcCardMedium}`}>
              <div className={s.calcHeader}>
                <div className={s.calcHeaderTitle}>Фактор Лоренца</div>
                <div className={s.calcHeaderSubtitle}>Релятивистское замедление времени</div>
              </div>
              <div className={s.calcBody}>
                <div className={s.calcInfo}>
                  Фактор Лоренца γ — безразмерная физическая величина, выражает, насколько изменяются измерения времени, длины и других физических свойств объекта при его перемещении.
                  <div className={s.calcInfoFormula}>γ = 1 / sqrt(1 - β<sup>2</sup>), где β = v/c</div>
                  Также: γ = E / (m c<sup>2</sup>).
                </div>
                <div className={s.calcInputsSingle}>
                  <label>
                    <div className={s.calcLabel}>Ввод через</div>
                    <select className={s.calcInput} value={lorentz.mode} onChange={(e) => setLorentz({ ...lorentz, mode: e.target.value })}>
                      <option value="beta">Скорость β = v/c</option>
                      <option value="energy">Энергия E / масса m</option>
                    </select>
                  </label>
                  <label>
                    <div className={s.calcLabel}>{lorentz.mode === "beta" ? "β = v/c (0 < β < 1)" : "Энергия E (ГэВ)"}</div>
                    <input className={s.calcInput} value={lorentz.val1} onChange={(e) => setLorentz({ ...lorentz, val1: e.target.value })} />
                  </label>
                  {lorentz.mode === "energy" && (
                    <label>
                      <div className={s.calcLabel}>Масса m (ГэВ/c<sup>2</sup>)</div>
                      <input className={s.calcInput} value={lorentz.val2} onChange={(e) => setLorentz({ ...lorentz, val2: e.target.value })} />
                    </label>
                  )}
                </div>
                <button className={s.calcButton} type="button" onClick={calcLorentz}>Рассчитать</button>
                <div className={`${s.calcResult} ${lorentz.error ? s.calcResultError : ""}`}>{lorentz.result}</div>
              </div>
            </div>

            <div className={`${s.calcCard} ${s.calcCardTall}`}>
              <div className={s.calcHeader}>
                <div className={s.calcHeaderTitle}>Быстрота</div>
                <div className={s.calcHeaderSubtitle}>Кинематические переменные</div>
              </div>
              <div className={s.calcBody}>
                <div className={s.calcInfo}>
                  Быстрота - в релятивистской кинематике монотонно возрастающая функция скорости, которая стремится к бесконечности, когда скорость стремится к скорости света

                  В пространстве Минковского быстрота представляет собой угол между касательной к мировой линии частицы и осью времени в базовой системе отсчёта.

                  Псевдобыстрота (η) — безразмерная физическая величина, показывающая, насколько направление движения элементарной частицы отличается от направления оси пучка.
                  <div className={s.calcInfoFormula}>η = -ln[tan(θ/2)]</div>
                  <div className={s.calcInfoFormula}>y = 1/2 ln[(E + p_z)/(E - p_z)]</div>
                  θ = 90° ⇒ η = 0. θ &lt; 90° ⇒ η &gt; 0. θ &gt; 90° ⇒ η &lt; 0.
                </div>
                <div className={s.calcInputs}>
                  <label>
                    <div className={s.calcLabel}>E (GeV) — для y</div>
                    <input className={s.calcInput} value={rap.E} onChange={(e) => setRap({ ...rap, E: e.target.value })} />
                  </label>
                  <label>
                    <div className={s.calcLabel}>p_z (GeV/c) — для y</div>
                    <input className={s.calcInput} value={rap.pz} onChange={(e) => setRap({ ...rap, pz: e.target.value })} />
                  </label>
                  <label className={s.calcInputFull}>
                    <div className={s.calcLabel}>Полярный угол θ</div>
                    <input className={s.calcInput} value={rap.theta} onChange={(e) => setRap({ ...rap, theta: e.target.value })} />
                  </label>
                </div>
                <button className={s.calcButton} type="button" onClick={calcRapidity}>Рассчитать</button>
                <div className={`${s.calcResult} ${rap.error ? s.calcResultError : ""}`}>{rap.result}</div>
              </div>
            </div>

            <div className={`${s.calcCard} ${s.calcCardMedium}`}>
              <div className={s.calcHeader}>
                <div className={s.calcHeaderTitle}>Энергия связи ядра</div>
                <div className={s.calcHeaderSubtitle}>Формула Вайцзеккера</div>
              </div>
              <div className={s.calcBody}>
                <div className={s.calcInfo}>
                  Энергия связи - это минимальная энергия, необходимая для расщепления ядра на его составляющие
                  <div className={s.calcInfoFormula}>
                    B = a<sub>v</sub>A - a<sub>s</sub>A<sup>2/3</sup> - a<sub>c</sub>Z(Z-1)/A<sup>1/3</sup> - a<sub>a</sub>(A-2Z)<sup>2</sup>/A ± δ
                  </div>
                  a<sub>v</sub>=15,56; a<sub>s</sub>=17,23; a<sub>c</sub>=0,697; a<sub>a</sub>=23,285 МэВ.

                  Энергия связи равна минимальной работе, которую необходимо затратить, чтобы разложить систему на составляющие её частицы. Она характеризует стабильность системы.
                </div>
                <div className={s.calcInputs}>
                  <label>
                    <div className={s.calcLabel}>Z (число протонов)</div>
                    <input className={s.calcInput} value={bind.Z} onChange={(e) => setBind({ ...bind, Z: e.target.value })} />
                  </label>
                  <label>
                    <div className={s.calcLabel}>A (массовое число)</div>
                    <input className={s.calcInput} value={bind.A} onChange={(e) => setBind({ ...bind, A: e.target.value })} />
                  </label>
                </div>
                <button className={s.calcButton} type="button" onClick={calcBinding}>Рассчитать</button>
                <div className={`${s.calcResult} ${bind.error ? s.calcResultError : ""}`}>{bind.result}</div>
              </div>
            </div>

            <div className={`${s.calcCard} ${s.calcCardMedium}`}>
              <div className={s.calcHeader}>
                <div className={s.calcHeaderTitle}>Поперечный импульс</div>
                <div className={s.calcHeaderSubtitle}>Ключевая переменная детектора</div>
              </div>
              <div className={s.calcBody}>
                <div className={s.calcInfo}>
                  Поперечный импульс — проекция импульса на плоскость, перпендикулярную оси пучка.
                  <div className={s.calcInfoFormula}>p<sub>T</sub> = |p| sin(θ) = sqrt(p<sub>x</sub><sup>2</sup> + p<sub>y</sub><sup>2</sup>)</div>
                  Изучение спектров поперечных импульсов, вычисленных в рамках различных моделей и измеренных экспериментально, помогает оценить адекватность тех или иных теоретических подходов к описанию процессов, происходящих в высокоэнергетичных столкновениях частиц.
                </div>
                <div className={s.calcInputs}>
                  <label>
                    <div className={s.calcLabel}>|p| (GeV/c)</div>
                    <input className={s.calcInput} value={pt.p} onChange={(e) => setPt({ ...pt, p: e.target.value })} />
                  </label>
                  <label>
                    <div className={s.calcLabel}>Полярный угол</div>
                    <input className={s.calcInput} value={pt.theta} onChange={(e) => setPt({ ...pt, theta: e.target.value })} />
                  </label>
                </div>
                <button className={s.calcButton} type="button" onClick={calcPt}>Рассчитать</button>
                <div className={`${s.calcResult} ${pt.error ? s.calcResultError : ""}`}>{pt.result}</div>
              </div>
            </div>
          </div>
        </Container3>
      </section>
    </div>
  );
}
