
import random

class WeatherAgent:
    def __init__(self, name="MeteoBot"):
        self.name = name

    def analyze(self, facts):
        """
        Метод принимает словарь фактов и определяет погоду
        на основе правил if-then.
        """
        temp = facts.get('temperature')  # Температура в градусах
        precip = facts.get('precipitation')  # Осадки: True/False
        wind = facts.get('wind_speed')   # Скорость ветра км/ч
        clouds = facts.get('cloud_cover') # Облачность: 0-100%

        # Логика агента (Knowledge Base)
        
        # 1. Сначала проверяем экстремальные условия
        if wind > 60:
            if precip and temp < 0:
                return "⚠ ОПАСНО: Снежная буря (Вьюга)"
            elif precip:
                return "⚠ ОПАСНО: Штормовой ливень"
            else:
                return "⚠ ОПАСНО: Ураганный ветер"

        # 2. Проверяем осадки
        if precip:
            if temp < 0:
                return "Идет снег"
            elif temp < 5:
                return "Мокрый снег с дождем"
            else:
                return "Дождь"

        # 3. Если осадков нет, смотрим на облачность и температуру
        if clouds < 20:
            if temp > 30:
                return "Жарко и солнечно"
            elif temp < -10:
                return "Морозно и ясно"
            else:
                return "Ясно (Солнечно)"
        
        elif clouds > 80:
            return "Пасмурно"
        
        else:
            # 4. Все остальные случаи
            if temp > 20:
                return "Тепло, переменная облачность"
            else:
                return "Прохладно, переменная облачность"

def generate_random_facts():
    """
    Функция генерирует случайные показания сенсоров (факты).
    """
    # Генерируем температуру от -20 до +35
    temp = random.randint(-20, 35)
    
    # Шанс осадков 30%
    precipitation = random.choice([True, False, False]) 
    
    # Ветер от 0 до 80 км/ч
    wind_speed = random.randint(0, 80)
    
    # Облачность от 0 до 100%
    cloud_cover = random.randint(0, 100)

    # Небольшая логическая корректировка для реалистичности:
    # Если есть осадки, облачность не может быть 0%
    if precipitation and cloud_cover < 50:
        cloud_cover = random.randint(50, 100)

    return {
        'temperature': temp,
        'precipitation': precipitation,
        'wind_speed': wind_speed,
        'cloud_cover': cloud_cover
    }

# --- ЗАПУСК ТЕСТА ---

if __name__ == "__main__":
    # Создаем экземпляр агента
    agent = WeatherAgent()

    print(f"--- Запуск агента {agent.name} ---\n")

    # Прогоним тест 5 раз
    for i in range(5):
        # 1. Получаем случайные факты
        facts = generate_random_facts()
        
        # 2. Спрашиваем агента
        conclusion = agent.analyze(facts)
        
        # 3. Выводим результат
        print(f"Тест #{i+1}")
        print(f"Факты: {facts}")
        print(f"Вердикт агента: >> {conclusion} <<")
        print("-" * 40)