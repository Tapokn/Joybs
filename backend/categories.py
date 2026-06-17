# -*- coding: utf-8 -*-
from typing import Optional

CATEGORIES = {
    # ===== 1. ЯЗЫКИ ПРОГРАММИРОВАНИЯ =====
    "Языки программирования": {
        "Python разработчик": ["Python разработчик", "Python developer", "питон разработчик"],
        "Java разработчик": ["Java разработчик", "Java developer", "джава разработчик"],
        "C++ разработчик": ["C++ разработчик", "C++ developer", "C++ программист"],
        "C# разработчик": ["C# разработчик", "C# developer", "C# программист"],
        "Go разработчик": ["Go разработчик", "Golang developer", "Go программист"],
        "Rust разработчик": ["Rust разработчик", "Rust developer"],
        "PHP разработчик": ["PHP разработчик", "PHP developer", "PHP программист"],
        "1С разработчик": ["1С разработчик", "1C developer", "1С программист"],
        "JavaScript разработчик": ["JavaScript разработчик", "JS developer", "JavaScript программист"],
        "TypeScript разработчик": ["TypeScript разработчик", "TS developer"],
    },
    # ===== 2. МОБИЛЬНАЯ РАЗРАБОТКА =====
    "Мобильная разработка": {
        "iOS разработчик": ["iOS разработчик", "iOS Developer", "Swift разработчик", "Swift developer"],
        "Android разработчик": ["Android разработчик", "Android Developer", "Kotlin разработчик","Kotlin developer", "Java (Android) разработчик"],
        "Flutter разработчик": ["Flutter разработчик", "Flutter Developer"],
    },
    # ===== 3. DESKTOP РАЗРАБОТКА =====
    "Desktop разработка": {
        "WPF разработчик": ["WPF разработчик", "WPF Developer"],
        "Qt разработчик": ["Qt разработчик", "Qt Developer"],
        "Delphi разработчик": ["Delphi разработчик", "Delphi Developer"],
    },
    # ===== 4. ВЕБ-РАЗРАБОТКА (ФРОНТЕНД ФРЕЙМВОРКИ) =====
    "Веб-разработка (фронтенд фреймворки)": {
        "React разработчик": ["React разработчик", "React Developer"],
        "Angular разработчик": ["Angular разработчик", "Angular Developer"],
        "Vue разработчик": ["Vue разработчик", "Vue Developer"],
        "HTML верстальщик": ["HTML верстальщик", "веб-верстальщик", "HTML-верстальщик"],
    },
    # ===== 5. ВЕБ-РАЗРАБОТКА (БЭКЕНД ФРЕЙМВОРКИ) =====
    "Веб-разработка (бэкенд фреймворки)": {
        "Node.js разработчик": ["Node.js разработчик", "Node.js Developer"],
        "Django разработчик": ["Django разработчик", "Django Developer"],
        "ASP.NET разработчик": ["ASP.NET разработчик", "ASP.NET Developer"],
        "Laravel разработчик": ["Laravel разработчик", "Laravel Developer"],
    },
    # ===== 6. ВЕБ-РАЗРАБОТКА (ОБЩИЕ РОЛИ) =====
    "Веб-разработка (общее)": {
        "Frontend-разработчик": ["Frontend", "Front-end разработчик", "Frontend Developer", "Front-end"],
        "Backend-разработчик": ["Backend", "Back-end разработчик", "Backend Developer", "Бэкенд", "Серверный разработчик"],
    },
    # ===== 7. FULLSTACK =====
    "Fullstack-разработка": {
        "Fullstack разработчик": ["Fullstack разработчик", "Full-stack разработчик", "Fullstack Developer", "Фулстек"],
    },
    # ===== 8. АНАЛИТИКА И ДАННЫЕ =====
    "Аналитика и данные": {
        "Аналитик данных": ["Аналитик данных", "Data Analyst", "Data analyst"],
        "Бизнес-аналитик": ["Бизнес-аналитик", "Business Analyst"],
        "Системный аналитик": ["Системный аналитик", "System Analyst"],
        "Продуктовый аналитик": ["Продуктовый аналитик", "Product Analyst"],
        "Маркетинговый аналитик": ["Маркетинговый аналитик", "Marketing Analyst"],
        "BI-разработчик": ["BI-разработчик", "BI Developer", "BI Analyst"],
        "Data Engineer": ["Data Engineer"],
        "Big Data инженер": ["Big Data Engineer", "Big Data разработчик"],
        "Data Architect": ["Data Architect", "Архитектор данных", "Data Warehouse Architect"],
    },
    # ===== 9. ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ И ML =====
    "Искусственный интеллект и ML": {
        "Data Scientist": ["Data Scientist", "Специалист по data science", "Data Science", "Исследователь данных"],
        "ML Engineer": ["ML Engineer", "Machine Learning Engineer"],
        "NLP-инженер": ["NLP Engineer", "Специалист по обработке естественного языка"],
        "Computer Vision инженер": ["Computer Vision Engineer", "CV Engineer"],
        "AI Researcher": ["Research Scientist", "AI Researcher", "Исследователь ИИ"],
        "Prompt Engineer": ["Prompt Engineer", "Инженер промптов"],
        "AI-архитектор": ["AI Architect", "Архитектор ИИ систем"],
    },
    # ===== 10. DEVOPS И ИНФРАСТРУКТУРА =====
    "DevOps и инфраструктура": {
        "DevOps-инженер": ["DevOps", "DevOps инженер", "DevOps Engineer", "Site Reliability Engineer", "SRE"],
        "Cloud Engineer": ["Cloud Engineer", "Облачный инженер", "Cloud Architect"],
        "Системный администратор": ["Системный администратор", "Sysadmin", "System Administrator", "Сисадмин"],
        "Сетевой инженер": ["Network Engineer", "Сетевой инженер"],
        "Database Administrator": ["DBA", "Database Administrator", "Администратор БД"],
        "Kubernetes инженер": ["K8s Engineer", "Kubernetes Administrator"],
        "Linux администратор": ["Linux Administrator", "Linux Sysadmin"],
    },
    # ===== 11. КИБЕРБЕЗОПАСНОСТЬ =====
    "Кибербезопасность": {
        "Инженер ИБ": ["Information Security Engineer", "InfoSec", "Специалист по ИБ", "Security Engineer"],
        "Аналитик ИБ": ["Security Analyst", "Аналитик ИБ", "SOC Analyst", "Аналитик центра мониторинга безопасности"],
        "AppSec инженер": ["Application Security Engineer", "AppSec"],
        "Penetration Tester": ["Penetration Tester", "Этичный хакер", "Red Team"],
        "GRC специалист": ["GRC специалист", "Governance Risk Compliance", "Security Auditor"],
    },
    # ===== 12. ТЕСТИРОВАНИЕ =====
    "Тестирование": {
        "QA инженер": ["QA", "QA инженер", "Тестировщик", "Quality Assurance", "Manual QA"],
        "Automation QA": ["Automation QA", "QA Automation", "Автотестировщик", "Test Automation Engineer"],
        "SDET": ["SDET", "Software Development Engineer in Test"],
    },
    # ===== 13. УПРАВЛЕНИЕ ПРОЕКТАМИ И ПРОДУКТАМИ =====
    "Управление проектами и продуктами": {
        "Project Manager": ["Project Manager", "PM", "Project Coordinator", "Руководитель проектов"],
        "IT Project Manager": ["IT Project Manager", "IT PM", "Менеджер IT-проектов"],
        "Product Owner": ["Product Owner", "Владелец продукта"],
        "Scrum Master": ["Scrum Master", "Scrum-мастер", "Agile Coach"],
        "Team Lead": ["Team Lead", "Tech Lead", "Тимлид"],
        "IT Director": ["IT Director", "Директор по IT", "Head of IT"],
    },
    # ===== 14. КОНСАЛТИНГ И КОРПОРАТИВНЫЕ СИСТЕМЫ =====
    "Консалтинг и корпоративные системы": {
        "ERP-консультант": ["ERP Consultant", "ERP Specialist"],
        "1С консультант": ["1С консультант", "1C Consultant"],
        "CRM-консультант": ["CRM Consultant", "CRM Analyst"],
        "IT-консультант": ["IT Consultant", "IT консультант"],
    },
    # ===== 15. ТЕХНИЧЕСКАЯ ДОКУМЕНТАЦИЯ =====
    "Техническая документация": {
        "Технический писатель": ["Technical Writer", "Технический писатель"],
    },
    # ===== 16. ПОДДЕРЖКА =====
    "Поддержка": {
        "Техническая поддержка": ["Technical Support", "Support Engineer", "Help Desk"],
        "Application Support": ["Application Support", "Support Analyst"],
        "L2/L3 поддержка": ["L2 Support", "L3 Support"],
    },
    # ===== 17. ИГРЫ =====
    "Игры": {
        "Game разработчик": ["Game Developer", "Разработчик игр"],
    },
}

def get_profession_group(profession: str) -> Optional[str]:
    """Возвращает группу для профессии, или None, если не найдено."""
    if not profession:
        return None
    profession_lower = profession.lower()
    for group, subdict in CATEGORIES.items():
        for prof_name, aliases in subdict.items():
            for alias in aliases:
                if alias.lower() == profession_lower:
                    return group
            # также сам prof_name
            if prof_name.lower() == profession_lower:
                return group
    return None