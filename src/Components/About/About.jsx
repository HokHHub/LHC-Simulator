import Container from '../Container/Container'
import s from './About.module.css'
import { useNavigate } from "react-router-dom";

export default function About(props) {
    const navigate = useNavigate();

    return (
        <>
            <main>
                <Container>
                    <div className={s.about}>
                        <img className={s.about__colliderImg} src="/img/colliderImg.png" alt="Адронный коллайдер" />
                        <div className={s.about__texts}>
                            <h1 className={s.about__text_span1}>СИМУЛЯТОР</h1>
                            <p className={s.about__text_span2}>БОЛЬШОГО АДРОННОГО КОЛЛАЙДЕРА</p>
                            <p className={s.about__text}>Наш проект — это виртуальная модель адронного коллайдера,
                                позволяющая моделировать столкновения элементарных частиц.
                                Выбирайте типы частиц, энергию и детекторы (ATLAS, CMS, LHCb),
                                чтобы увидеть возможные реакции и визуализацию событий.
                                Изучайте законы сохранения, рождение резонансов и
                                работу реальных детекторов ЦЕРНа в интерактивном формате.</p>
                        </div>
                    </div>
                    <div className={s.other}>
                        <h2 className={s.other__title}>Симуляция</h2>
                        <p className={s.other__text}>Начните прямо сейчас! Нажмите кнопку "Начать эксперимент" и погрузитесь в удивительный мир элементарных частиц. Кликайте мышью, создавайте частицы и наблюдайте за тем, как разворачивается квантовый хаос на вашем экране.</p>
                        <button onClick={() => navigate('/simulation')} className={s.other__btn}>Начать эксперимент</button>
                    </div>
                </Container>
            </main>
        </>
    )
}