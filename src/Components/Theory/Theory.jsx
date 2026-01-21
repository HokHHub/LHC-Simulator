import Container2 from '../Container2/Container2'
import s from './Theory.module.css'
import Modal from '../Modal/Modal'
import { useState } from 'react';

export default function Theory(props) {
    const [open, setOpen] = useState(false);
    const proton = {
        title: "Proton",
        iconText: "p",
        description:
            "Протон — первичный «кирпичик» видимой Вселенной. Это стабильная положительно заряженная частица, основа атомных ядер. Именно количество протонов в ядре определяет химический элемент",
        stats: [
            { label: "Семья", value: "Адрон" },
            { label: "Масса", value: "0,938 GeV" },
            { label: "Стабильность", value: "Стабилен" },
            { label: "Взаимодействие", value: "Сильное" },
            { label: "Спин", value: "1/2" },
            { label: "Заряд", value: "1" },
            { label: "S, C, B, L", value: "0, 0, 1, 0" },
            { label: "Состав", value: "uud" },
        ],
    };

    return (
        <>
            <main>
                <Container2>
                    <h2 className={s.theory__title}>Теория элементарных частиц</h2>
                    <div className={s.theory}>
                        <p className={s.theory__mainText}>Список частиц</p>
                        <input className={s.theory__input} placeholder="Поиск частиц по названию или свойствам..." />
                        <div className={s.theory__buttons}>
                            <button className={s.theory__button}>Адроны</button>
                            <button className={s.theory__button}>Кварки</button>
                            <button className={s.theory__button}>Лептоны</button>
                            <button className={s.theory__button}>Бозоны</button>
                        </div>
                        <div className={s.theory__cards}>
                            <div onClick={() => setOpen(true)} className={s.theory__card}>
                                <div className={s.theory__card_textBlock}>
                                    <div>
                                        <p className={s.theory__card_text}>0,938 GeV</p>
                                        <p className={s.theory__card_text}>Q = +1</p>
                                        <p className={s.theory__card_text}>J = 1/2 ħ</p>
                                    </div>
                                    <div className={s.theory__card_imgGroup}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90" fill="none">
                                            <g filter="url(#filter0_i_1_43)">
                                                <circle cx="45" cy="45" r="45" fill="#4E3F8F" />
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
                                            <p className={s.theory__card_imgText}>p</p>
                                        </div>
                                    </div>
                                </div>
                                <p className={s.theory__card_title}>Proton</p>
                            </div>
                            <div onClick={() => setOpen(true)} className={s.theory__card}>
                                <div className={s.theory__card_textBlock}>
                                    <div>
                                        <p className={s.theory__card_text}>0,938 GeV</p>
                                        <p className={s.theory__card_text}>Q = +1</p>
                                        <p className={s.theory__card_text}>J = 1/2 ħ</p>
                                    </div>
                                    <div className={s.theory__card_imgGroup}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90" fill="none">
                                            <g filter="url(#filter0_i_1_43)">
                                                <circle cx="45" cy="45" r="45" fill="#4E3F8F" />
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
                                            <p className={s.theory__card_imgText}>p</p>
                                        </div>
                                    </div>
                                </div>
                                <p className={s.theory__card_title}>Proton</p>
                            </div>
                            <div onClick={() => setOpen(true)} className={s.theory__card}>
                                <div className={s.theory__card_textBlock}>
                                    <div>
                                        <p className={s.theory__card_text}>0,938 GeV</p>
                                        <p className={s.theory__card_text}>Q = +1</p>
                                        <p className={s.theory__card_text}>J = 1/2 ħ</p>
                                    </div>
                                    <div className={s.theory__card_imgGroup}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90" fill="none">
                                            <g filter="url(#filter0_i_1_43)">
                                                <circle cx="45" cy="45" r="45" fill="#4E3F8F" />
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
                                            <p className={s.theory__card_imgText}>p</p>
                                        </div>
                                    </div>
                                </div>
                                <p className={s.theory__card_title}>Proton</p>
                            </div>
                            <div onClick={() => setOpen(true)} className={s.theory__card}>
                                <div className={s.theory__card_textBlock}>
                                    <div>
                                        <p className={s.theory__card_text}>0,938 GeV</p>
                                        <p className={s.theory__card_text}>Q = +1</p>
                                        <p className={s.theory__card_text}>J = 1/2 ħ</p>
                                    </div>
                                    <div className={s.theory__card_imgGroup}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90" fill="none">
                                            <g filter="url(#filter0_i_1_43)">
                                                <circle cx="45" cy="45" r="45" fill="#4E3F8F" />
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
                                            <p className={s.theory__card_imgText}>p</p>
                                        </div>
                                    </div>
                                </div>
                                <p className={s.theory__card_title}>Proton</p>
                            </div>
                            <div onClick={() => setOpen(true)} className={s.theory__card}>
                                <div className={s.theory__card_textBlock}>
                                    <div>
                                        <p className={s.theory__card_text}>0,938 GeV</p>
                                        <p className={s.theory__card_text}>Q = +1</p>
                                        <p className={s.theory__card_text}>J = 1/2 ħ</p>
                                    </div>
                                    <div className={s.theory__card_imgGroup}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90" fill="none">
                                            <g filter="url(#filter0_i_1_43)">
                                                <circle cx="45" cy="45" r="45" fill="#4E3F8F" />
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
                                            <p className={s.theory__card_imgText}>p</p>
                                        </div>
                                    </div>
                                </div>
                                <p className={s.theory__card_title}>Proton</p>
                            </div>
                            <Modal isOpen={open} onClose={() => setOpen(false)} data={proton} />
                        </div>
                    </div>
                </Container2>
            </main>
        </>
    )
}