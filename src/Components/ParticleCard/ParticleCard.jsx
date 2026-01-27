import s from "../Theory/Theory.module.css";
import { formatNumber } from "../../utils/formatNumber";

const formatCharge = (q) => {
    const n = Number(q);
    if (Number.isNaN(n)) return String(q);
    if (n === 0) return "0";
    return n > 0 ? `+${n}` : `${n}`;
};

export default function ParticleCard({ particle, onClick }) {
    const { symbol, name, mass, charge, spin, color = "#4E3F8F" } = particle;

    const iconText = (symbol || "?").toLowerCase();

    return (
        <div onClick={onClick} className={s.theory__card} style={{ "--accent-color": color }}>
            <div className={s.theory__card_textBlock}>
                <div>
                    <p className={s.theory__card_text}>
                        {formatNumber(mass)} GeV
                    </p>

                    <p className={s.theory__card_text}>
                        Q = {formatNumber(charge)}
                    </p>

                    <p className={s.theory__card_text}>J = {spin} ħ</p>
                </div>

                <div className={s.theory__card_imgGroup}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90" fill="none">
                        <g filter="url(#filter0_i_1_43)">
                            <circle cx="45" cy="45" r="45" fill="var(--accent-color)" />
                        </g>
                        <defs>
                            <filter id="filter0_i_1_43" x="0" y="0" width="91" height="97" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                                <feMorphology radius="1" operator="erode" in="SourceAlpha" result="effect1_innerShadow_1_43" />
                                <feOffset dx="1" dy="7" />
                                <feGaussianBlur stdDeviation="8.5" />
                                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                                <feColorMatrix type="matrix" values="0 0 0 0 0.75 0 0 0 0 0.75 0 0 0 0 0.75 0 0 0 0.24 0" />
                                <feBlend mode="normal" in2="shape" result="effect1_innerShadow_1_43" />
                            </filter>
                        </defs>
                    </svg>

                    <div className={s.test}>
                        <p className={s.theory__card_imgText}>{iconText}</p>
                    </div>
                </div>
            </div>

            <p className={s.theory__card_title}>{name}</p>
        </div>
    );
}
