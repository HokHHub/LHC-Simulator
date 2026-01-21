import Container from '../Container/Container'
import s from './About.module.css'

export default function About(props) {
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
                </Container>
            </main>
        </>
    )
}