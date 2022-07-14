# Описание

Приложение для демонстрации равномерное обработки сообщений из очереди `RabbitMQ`.

# Настройки приложения

Настройки указываются в файле `.env`. Переменная `CONSUMERS_COUNT` указывает количество экземпляров
приложения, которые будут потреблять сообщения из очереди.

# Запуск приложения

```bash
docker-compose build
docker-compose up -d
```

# Остановка приложения

```bash
docker-compose down
```

# Использование

Для наблюдения процесса обработки сообщений из очереди можно воспользоваться логами `docker-compose` с помощью команды

```bash
docker-compose logs consumer -f
```

Для того, чтобы добавить в очередь сообщения необходимо вызвать метод
приложения `producer` следующим запросом

```bash
curl --location --request POST 'http://localhost:3000/produce' \
--header 'Content-Type: application/json' \
--data-raw '{
    "quantity": 400
}'
```

В теле запроса можно указать количество сообщений, которые должны быть добавлены в очередь.
