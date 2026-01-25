// import Container from "../Container/Container";
import s from "./Footer.module.css";

export default function Header() {
    let date = new Date()
  return (
    <footer className={s.footer}>
        <p className={s.footer__title}>Интерактивный симулятор БАК</p>
        <p className={s.footer__year}>{date.getFullYear()}</p>
        <p className={s.footer__email}>email: <a href="mailto:lhc-simulator@yandex.ru">lhc-simulator@yandex.ru</a></p>
    </footer>
  );
}
