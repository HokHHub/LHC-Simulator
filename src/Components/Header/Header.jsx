import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTTS } from "../../utils/usePagesTTS";
import { useAuth } from "../../context/AuthContext";
import Container from "../Container/Container";
import s from "./Header.module.css";

export default function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const panelRef = useRef(null);

  const go = (path) => {
    // Проверяем авторизацию для защищенных страниц
    if ((path === "/profile" || path === "/simulation") && !isAuthenticated) {
      navigate("/login", { state: { from: { pathname: path } } });
      setIsMenuOpen(false);
      return;
    }
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

  // Получаем первую букву имени пользователя для аватара
  const getAvatarLetter = () => {
    if (user?.first_name) {
      return user.first_name.charAt(0).toUpperCase();
    }
    if (user?.username) {
      return user.username.charAt(0).toUpperCase();
    }
    return "👤"; // Иконка человека по умолчанию
  };


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
              <div
                onClick={() => go("/profile")}
                style={{
                  width: '31px',
                  height: '31px',
                  borderRadius: '50%',
                  backgroundColor: '#023E8A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: 'transparent',
                  textShadow: '0 0 0 white',
                }}
                role="button"
                aria-label="Перейти в профиль"
              >
                {getAvatarLetter()}
              </div>
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
            <button type="button" className={s.mobileMenu__link} onClick={() => go("/profile")}>
              Профиль
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
