"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Brain, Facebook, GraduationCap, Instagram, Lightbulb, Mail, Phone, Star } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { BrandLogo } from "@/components/brand-logo"
import { XPatternBackdrop } from "@/components/x-pattern-backdrop"

const FAQ_ITEMS = [
  {
    q: "Что такое пробное ЕНТ и чем оно полезно?",
    a: "Пробное ЕНТ — это симуляция реального экзамена с актуальными вопросами. Оно помогает понять текущий уровень и составить план подготовки.",
  },
  {
    q: "Оплата распространяется на один раз сдачи пробного ЕНТ?",
    a: "Да, каждая попытка оплачивается отдельно. Вы можете пополнить баланс заранее и использовать средства в любое удобное время.",
  },
  {
    q: "Вопросы соответствуют 2025–2026 учебному году?",
    a: "Да, база вопросов регулярно обновляется и соответствует последним изменениям центра тестирования на 2025–2026 год.",
  },
  {
    q: "Когда я получу результаты?",
    a: "Результаты доступны сразу после завершения теста. В личном кабинете вы увидите детальный анализ ответов и свой итоговый балл.",
  },
  {
    q: "Как происходит оплата?",
    a: "Оплата производится через QR-код по Kaspi Pay или любым другим банком. Деньги зачисляются мгновенно на ваш личный кабинет.",
  },
]

const WHY_ITEMS = [
  {
    title: "Стресс-тест и тайм-менеджмент",
    text: "тренируете скорость и распределение времени в реальном формате.",
  },
  {
    title: "Стратегия баллов",
    text: "понимаете, какие предметы/подтемы выгоднее «добрать» первыми.",
  },
  {
    title: "Привычка к процедуре",
    text: "интерфейс, правила, таймер — без сюрпризов в день экзамена.",
  },
  {
    title: "Статистика по попыткам",
    text: "виден эффект от каждой недели подготовки.",
  },
  {
    title: "Экономия",
    text: "точечно закрываете пробелы вместо бесконечных общих занятий.",
  },
]

export function NarxozLandingClient() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const toggleMenu = useCallback(() => setMobileOpen((o) => !o), [])
  const closeMenu = useCallback(() => setMobileOpen(false), [])

  const toggleFaq = useCallback((index: number) => {
    setFaqOpen((prev) => (prev === index ? null : index))
  }, [])

  useEffect(() => {
    const id = "narxoz-landing-fonts"
    if (document.getElementById(id)) return
    const pre = document.createElement("link")
    pre.rel = "preconnect"
    pre.href = "https://fonts.googleapis.com"
    const link = document.createElement("link")
    link.id = id
    link.rel = "stylesheet"
    link.href =
      "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap"
    document.head.appendChild(pre)
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = root.querySelectorAll(".card, .step-pill, .step-4-row, .faq-item, .why-panel")
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const h = e.target as HTMLElement
            h.style.opacity = "1"
            h.style.transform = "translateY(0)"
          }
        })
      },
      { threshold: 0.08 },
    )
    els.forEach((el) => {
      const h = el as HTMLElement
      h.style.opacity = "0"
      h.style.transform = "translateY(16px)"
      h.style.transition = "opacity 0.45s ease, transform 0.45s ease"
      observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <XPatternBackdrop className="narxoz-landing-root">
    <div className="narxoz-landing" ref={rootRef}>
      <nav>
        <Link href="/" className="logo nav-logo-link" onClick={closeMenu}>
          <BrandLogo width={160} height={44} className="nav-logo" priority />
        </Link>

        <ul className="nav-links">
          <li>
            <a href="#features">Особенности</a>
          </li>
          <li>
            <a href="#promo">Преимущества</a>
          </li>
          <li>
            <a href="#payment">Оплата</a>
          </li>
          <li>
            <a href="#faq">FAQ</a>
          </li>
        </ul>

        <Link href="/auth/login" className="btn-login">
          Войти
        </Link>

        <button type="button" className="hamburger" onClick={toggleMenu} aria-label="Menu">
          <span />
          <span />
          <span />
        </button>
      </nav>

      <div className={`mobile-menu${mobileOpen ? " open" : ""}`}>
        <a href="#features" onClick={closeMenu}>
          Особенности
        </a>
        <a href="#promo" onClick={closeMenu}>
          Преимущества
        </a>
        <a href="#payment" onClick={closeMenu}>
          Оплата
        </a>
        <a href="#faq" onClick={closeMenu}>
          FAQ
        </a>
        <Link href="/auth/login" onClick={closeMenu} style={{ color: "var(--red)", fontWeight: 700 }}>
          Войти / Регистрация
        </Link>
      </div>

            <section className="hero" id="home">
        <div className="hero-card">
          <div className="hero-content">
            <span className="hero-badge">
              <GraduationCap className="hero-badge-icon" strokeWidth={2.5} aria-hidden />
              Пробное ЕНТ онлайн для 10–11 классов
            </span>
            <h1>
              Проверь свою готовность к ЕНТ-2026: пройди пробный тест и узнай результат!
            </h1>
            <p className="hero-highlight">
              Максимальное погружение в экзамен с актуальной базой вопросов.
            </p>
            <ul className="hero-features">
              <li>Симулятор реального ЕНТ: интерфейс и тайминг «один в один».</li>
              <li>Экспертная база актуальных вопросов 2025–2026</li>
              <li>Индивидуальный Roadmap: анализ ошибок и стратегия подготовки.</li>
            </ul>
            <p className="hero-price">Пробный онлайн ЕНТ — всего 1 000 ₸</p>
            <p className="hero-price-sub">Узнай свой реальный балл и слабые места.</p>
            <Link href="/auth/sign-up" className="btn-primary hero-cta">
              Пройти регистрацию
            </Link>
          </div>
          <div className="hero-image">
            <Image
              src="/boy.png"
              alt="Ученик готовится к пробному ЕНТ"
              fill
              className="hero-photo-img"
              sizes="(max-width: 900px) 100vw, 520px"
              priority
            />
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="features-inner">
          <h2 className="section-title">Твоя генеральная репетиция ЕНТ</h2>
          <p className="section-sub">
            Мы воссоздали условия реального тестирования, чтобы на самом экзамене ты чувствовал себя как дома.
          </p>
          <div className="cards-grid">
            <div className="card">
              <div className="card-icon">
                <Star className="card-icon-svg" strokeWidth={2.5} />
              </div>
              <h3>Актуальная база 2025–2026</h3>
              <p>
                Забудь про устаревшие вопросы. Ты тренируешься на заданиях, которые соответствуют последним
                изменениям центра тестирования.
              </p>
            </div>
            <div className="card">
              <div className="card-icon">
                <Brain className="card-icon-svg" strokeWidth={2.5} />
              </div>
              <h3>Идентичный интерфейс и регламент времени</h3>
              <p>
                Программная среда тренажера, логика навигации и система контроля времени (таймер) полностью
                дублируют реальный экзамен.
              </p>
            </div>
            <div className="card">
              <div className="card-icon">
                <Lightbulb className="card-icon-svg" strokeWidth={2.5} />
              </div>
              <h3>Система прокторинга и контроля</h3>
              <p>
                Прокторинг исключает возможность подсказок, приучая тебя к дисциплине реального экзамена. Ты
                получаешь объективный балл, который показывает твою реальную готовность к ЕНТ без иллюзий.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="why" id="promo">
        <div className="why-photo">
          <Image
            src="/girl.png"
            alt="Ученица готовится к пробному ЕНТ"
            width={316}
            height={480}
            className="why-photo-img"
            sizes="(max-width: 900px) 80vw, 316px"
          />
        </div>
        <div className="why-panel">
          <h2 className="why-title">Почему пробное ЕНТ необходимо</h2>
          <ul className="why-list">
            {WHY_ITEMS.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong> — {item.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="how">
        <div className="how-inner">
          <h2 className="section-title">Как это работает?</h2>
          <p className="section-sub">Пройди тест и узнай свой реальный итоговый балл.</p>
          <div className="how-layout">
            <div className="how-steps">
              <div className="step-pill">
                <span className="step-pill-num">1</span>
                <span className="step-pill-label">Сдача теста</span>
              </div>
              <div className="step-pill">
                <span className="step-pill-num">2</span>
                <span className="step-pill-label">Анализ ответов</span>
              </div>
              <div className="step-pill">
                <span className="step-pill-num">3</span>
                <span className="step-pill-label">Готовый результат</span>
              </div>
            </div>
            <div className="how-mockups">
              <div className="mockup mockup-test">
                <div className="mockup-header">
                  <span className="mockup-title">ЕНТ 2026 · Математика</span>
                  <span className="mockup-exit">Выйти</span>
                </div>
                <p className="mockup-q-label">Вопрос 1</p>
                <p className="mockup-q-text">
                  Площадь прямоугольника равна 48, одна сторона равна 8. Найдите другую сторону.
                </p>
                <div className="mockup-options">
                  <label>
                    <span className="mockup-radio" /> 4
                  </label>
                  <label>
                    <span className="mockup-radio" /> 6
                  </label>
                  <label>
                    <span className="mockup-radio mockup-radio-on" /> 8
                  </label>
                  <label>
                    <span className="mockup-radio" /> 12
                  </label>
                </div>
                <div className="mockup-footer">
                  <button type="button" className="mockup-nav mockup-nav-muted">
                    Предыдущий
                  </button>
                  <div className="mockup-progress">
                    <div className="mockup-progress-fill" />
                  </div>
                  <button type="button" className="mockup-nav mockup-nav-primary">
                    Следующий
                  </button>
                </div>
              </div>
              <div className="mockup mockup-results">
                <div className="mockup-results-bg" />
                <div className="mockup-modal">
                  <div className="mockup-modal-icon">✓</div>
                  <h3>Результаты теста</h3>
                  <p className="mockup-modal-sub">Тест завершен!</p>
                  <p className="mockup-score">2 / 4</p>
                  <div className="mockup-modal-bar">
                    <div className="mockup-modal-bar-fill" />
                  </div>
                  <div className="mockup-modal-actions">
                    <button type="button" className="mockup-btn mockup-btn-outline">
                      Подробнее
                    </button>
                    <button type="button" className="mockup-btn mockup-btn-primary">
                      Закрыть
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pricing-steps" id="payment">
        <h2 className="section-title pricing-title">
          Узнай свой реальный балл за <span className="pricing-amount">1 000 ₸</span>
        </h2>
        <p className="section-sub pricing-sub">Всего 4 шага до старта</p>
        <div className="steps-4-vertical">
                    <div className="step-4-row">
            <span className="step-4-num">1</span>
            <div className="step-4-pill">
              <p>
                <strong>Регистрация.</strong> Создайте аккаунт на сайте всего за 1 минуту
              </p>
            </div>
          </div>
                    <div className="step-4-row">
            <span className="step-4-num">2</span>
            <div className="step-4-pill">
              <p>
                <strong>Личный кабинет.</strong> Перейдите в раздел оплаты в своём профиле
              </p>
            </div>
          </div>
                    <div className="step-4-row">
            <span className="step-4-num">3</span>
            <div className="step-4-pill">
              <p>
                <strong>Оплата по QR.</strong> Пополните баланс мгновенно через Kaspi или любой банк
              </p>
            </div>
          </div>
                    <div className="step-4-row">
            <span className="step-4-num">4</span>
            <div className="step-4-pill">
              <p>
                <strong>Старт.</strong> Начните симуляцию ЕНТ сразу после подтверждения платежа
              </p>
            </div>
          </div>
        </div>
        <p className="pricing-tip">
          Удобно: Вы можете пополнить баланс на любую сумму.
          <br />
          Средства в личном кабинете не сгорают — используйте их для тренировок в любое удобное время.
        </p>
      </section>

      <section className="includes">
        <h2 className="includes-title">Что включено:</h2>
        <div className="includes-list">
          <span className="include-pill">интерфейс как на реальном ЕНТ</span>
          <span className="include-pill">актуальные вопросы 2025-2026</span>
          <span className="include-pill">Личный кабинет с историей попыток</span>
        </div>
        <p className="pricing-note">
          * Автопродления нет. Отменять ничего не нужно. * Кому подойдёт: 10–11 классы
        </p>
        <Link href="/auth/sign-up" className="btn-primary">
          Пройти регистрацию
        </Link>
      </section>

      <section className="faq" id="faq">
        <div className="faq-inner">
          <h2 className="section-title">Часто задаваемые вопросы</h2>
          <p className="section-sub">Если не нашли ответ — напишите нам.</p>

          {FAQ_ITEMS.map((item, index) => (
            <div key={item.q} className={`faq-item${faqOpen === index ? " open" : ""}`}>
              <button type="button" className="faq-q" onClick={() => toggleFaq(index)}>
                {item.q}
                <span className="faq-icon">{faqOpen === index ? "×" : "+"}</span>
              </button>
              <div className="faq-a">{item.a}</div>
            </div>
          ))}
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <BrandLogo width={200} height={54} className="footer-logo" priority />
            <p>
              Онлайн-платформа для подготовки к ЕНТ с актуальными вопросами, детальным анализом результатов и
              персональным планом обучения. Готовься эффективно и поступай на грант!
            </p>
          </div>
          <div className="footer-col">
            <h4>Навигация</h4>
            <ul>
              <li>
                <a href="#home">Главная</a>
              </li>
              <li>
                <a href="#features">Особенности</a>
              </li>
              <li>
                <a href="#promo">Преимущества</a>
              </li>
              <li>
                <a href="#payment">Оплата</a>
              </li>
              <li>
                <a href="#faq">FAQ</a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Свяжитесь с нами</h4>
            <div className="contact-item">
              <span className="contact-icon" aria-hidden>
                <Phone />
              </span>
              <a href="tel:+77773478899">+7 777 347 88 99</a>
            </div>
            <div className="contact-item">
              <span className="contact-icon" aria-hidden>
                <Instagram />
              </span>
              <a href="https://instagram.com/narxozkz" target="_blank" rel="noreferrer">
                @narxozkz
              </a>
            </div>
            <div className="contact-item">
              <span className="contact-icon" aria-hidden>
                <Facebook />
              </span>
              <a href="https://www.facebook.com/narxozkz" target="_blank" rel="noreferrer">
                Narxoz University
              </a>
            </div>
            <div className="contact-item">
              <span className="contact-icon" aria-hidden>
                <Mail />
              </span>
              <a className="contact-email" href="mailto:admission@narxoz.kz">
                admission@narxoz.kz
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">© 2026 Narxoz University. Все права защищены.</div>
      </footer>
    </div>
    </XPatternBackdrop>
  )
}
