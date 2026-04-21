# TODOLIST — VK Transleator

## В работе

_Нет активных задач_

## Бэклог

- [ ] Проверить работу Realtime на Supabase Cloud после деплоя
- [ ] Настроить Vercel env vars и сделать тестовый деплой
- [ ] Запустить install.sh на VPS obs.kalininlive.ru
- [ ] Проверить оверлей в OBS Browser Source
- [ ] Протестировать старт/стоп трансляции через AdminPanel

## Завершено

- [x] Переход с single-VPS на Vercel + Supabase Cloud + VPS
- [x] Убран Docker-стек postgres/postgrest/realtime (WebSocket не работал)
- [x] api.py переведён с psycopg2 на HTTP REST к Supabase
- [x] install.sh: admin credentials записываются в Supabase через REST API
- [x] supabase_setup.sql очищен от self-hosted секций
- [x] Очистка проекта: удалены .ssh/, legacy scripts, старая история git
- [x] API_SECRET вынесен в env var (не хардкод)
