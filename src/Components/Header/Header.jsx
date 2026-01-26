import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTTS } from "../../utils/usePagesTTS";
import Container from "../Container/Container";
import s from "./Header.module.css";

export default function Header() {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const panelRef = useRef(null);

  const go = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    if (isMenuOpen) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMenuOpen]);

  const onOverlayClick = (e) => {
    if (panelRef.current && !panelRef.current.contains(e.target)) {
      setIsMenuOpen(false);
    }
  };

  const { supported, isSpeaking, toggleSpeak } = usePageTTS({
    rootSelector: "main, #root", // озвучит всю страницу (контент), не только header
    lang: "ru-RU",
    rate: 1,
  });


  return (
    <header className={s.header}>
      <Container>
        <div className={s.header__wrapper}>
          <div onClick={() => go("/")} className={s.header__logos}>
            <img className={s.header__img} src="/img/Logo.png" alt="Логотип LHC Simulator" />
            <p className={s.header__title}>LHC Simulator</p>
          </div>


          <div className={s.header__wrappernd}>
            <nav className={s.header__links}>
              <a href="#" onClick={(e) => { e.preventDefault(); go("/theory"); }} className={s.header__link}>Теория</a>
              <a href="#" onClick={(e) => { e.preventDefault(); go("/"); }} className={s.header__link}>О проекте</a>
              <a href="#" onClick={(e) => { e.preventDefault(); go("/simulation"); }} className={s.header__link}>Симуляции</a>
            </nav>
            <div className={s.header__actions}>
              {supported && (
                <button
                  type="button"
                  className={`${s.ttsBtn} ${isSpeaking ? s.ttsBtn_active : ""}`}
                  onClick={toggleSpeak}
                  aria-pressed={isSpeaking}
                  aria-label={isSpeaking ? "Остановить озвучку страницы" : "Озвучить страницу"}
                  title={isSpeaking ? "Остановить озвучку" : "Озвучить страницу"}
                >
                  {isSpeaking ? "🔇" : "🔊"}
                </button>
              )}

              <button
                type="button"
                className={`${s.burger} ${isMenuOpen ? s.burger_open : ""}`}
                aria-label="Открыть меню"
                aria-expanded={isMenuOpen}
                onClick={() => setIsMenuOpen((v) => !v)}
              >
                <span />
                <span />
                <span />
              </button>
            </div>
          </div>
        </div>


      </Container>

      <div
        className={`${s.mobileMenu} ${isMenuOpen ? s.mobileMenu_open : ""}`}
        onMouseDown={onOverlayClick}
        aria-hidden={!isMenuOpen}
      >
        <div ref={panelRef} className={s.mobileMenu__panel}>
          <div className={s.mobileMenu__top}>
            <p className={s.mobileMenu__title}>Меню</p>
            <button
              type="button"
              className={s.mobileMenu__close}
              aria-label="Закрыть меню"
              onClick={() => setIsMenuOpen(false)}
            >
              ×
            </button>
          </div>

          <div className={s.mobileMenu__links}>
            <button type="button" className={s.mobileMenu__link} onClick={() => go("/theory")}>
              Теория
            </button>
            <button type="button" className={s.mobileMenu__link} onClick={() => go("/")}>
              О проекте
            </button>
            <button type="button" className={s.mobileMenu__link} onClick={() => go("/simulation")}>
              Симуляции
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
