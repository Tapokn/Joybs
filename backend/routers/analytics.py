from fastapi import APIRouter, Query, HTTPException
from backend.database import get_db
from backend.categories import get_profession_group
import aiosqlite
import json
import re
import statistics
import math
from collections import Counter, defaultdict

router = APIRouter()

# ---------- Вспомогательные функции ----------
def parse_skills(skill_str):
    if not skill_str or not skill_str.strip():
        return []
    try:
        skills_list = json.loads(skill_str)
        if isinstance(skills_list, list):
            return [s.strip().lower() for s in skills_list if s and s.strip()]
    except (json.JSONDecodeError, TypeError):
        pass
    clean = re.sub(r'[\[\]"\'\\]', '', skill_str)
    parts = re.split(r'[,;]', clean)
    return [p.strip().lower() for p in parts if p.strip()]

def compute_median_salary(row):
    s_from = row.get('salary_from')
    s_to = row.get('salary_to')
    if s_from is not None and s_to is not None:
        return (s_from + s_to) / 2
    elif s_from is not None:
        return s_from
    elif s_to is not None:
        return s_to
    return None

def filter_by_context(rows, context_type, context_value):
    if context_type == "all" or not context_value:
        return rows
    filtered = []
    for r in rows:
        if context_type == "group":
            prof = r.get('profession')
            if prof:
                group = get_profession_group(prof)
                if group == context_value:
                    filtered.append(r)
        elif context_type == "profession":
            if r.get('profession') == context_value:
                filtered.append(r)
    return filtered

def get_salary_rows(rows):
    """Возвращает список (salary_median, row) для RUR и медианы в диапазоне 10k-600k."""
    salary_data = []
    for r in rows:
        if r.get('salary_currency') != 'RUR':
            continue
        med = compute_median_salary(r)
        if med is None:
            continue
        if 10000 <= med <= 600000:
            salary_data.append((med, r))
    return salary_data

def calculate_histogram(salary_data, bin_size=10000):
    if not salary_data:
        return []
    salaries = [s for s, _ in salary_data]
    min_s = 10000
    max_s = 600000
    bins = list(range(min_s, max_s + bin_size, bin_size))
    hist = [0] * (len(bins) - 1)
    for s in salaries:
        if s < min_s or s >= max_s:
            continue
        idx = int((s - min_s) // bin_size)
        if idx < len(hist):
            hist[idx] += 1
    return [{"bin_start": bins[i], "count": hist[i]} for i in range(len(hist)) if hist[i] > 0]

def calculate_pie_data(rows, context_type, context_value):
    """Группировка: если all -> по profession; group -> по search_query; profession -> по title."""
    if context_type == "all":
        group_key = "profession"
    elif context_type == "group":
        group_key = "search_query"
    else:  # profession
        group_key = "title"
    counter = Counter()
    for r in rows:
        val = r.get(group_key)
        if val:
            counter[val] += 1
    total = sum(counter.values())
    # объединяем доли <1% в "Другие"
    threshold = 0.01
    main = {}
    other = 0
    for k, cnt in counter.items():
        if cnt / total < threshold:
            other += cnt
        else:
            main[k] = cnt
    if other > 0:
        main["Другие"] = other
    return [{"label": k, "count": v} for k, v in main.items()]

def calculate_median_by_groups(rows, context_type, context_value):
    """Группировка для медиан: all -> profession_group; group -> search_query; profession -> experience."""
    if context_type == "all":
        group_key = "profession_group"  # вычисляем динамически
    elif context_type == "group":
        group_key = "search_query"
    else:  # profession -> группируем по опыту
        group_key = "experience"
    
    groups = defaultdict(list)
    for r in rows:
        if context_type == "all":
            prof = r.get('profession')
            if prof:
                g = get_profession_group(prof)
            else:
                continue
        else:
            g = r.get(group_key)
        if not g:
            continue
        med = compute_median_salary(r)
        if med is not None and 10000 <= med <= 600000 and r.get('salary_currency') == 'RUR':
            groups[g].append(med)
    
    result = []
    for g, vals in groups.items():
        if vals:
            result.append({
                "label": g,
                "median_salary": statistics.median(vals),
                "count": len(vals)
            })
    return result

def calculate_distributions(rows):
    fields = ['work_format', 'experience', 'employment_form', 'accredited_it']
    dist = {}
    for f in fields:
        counter = Counter()
        for r in rows:
            val = r.get(f)
            if val is not None and val != '':
                counter[val] += 1
        dist[f] = [{"value": k, "count": v} for k, v in counter.items()]
    return dist

# ---------- Эндпоинты ----------
@router.get("/analytics/overview")
async def get_overview(
    context_type: str = Query("all", pattern="^(all|group|profession)$"),
    context_value: str = Query(None)
):
    conn = await get_db()
    cursor = await conn.execute("SELECT * FROM vacancies")
    rows = await cursor.fetchall()
    await conn.close()
    rows = [dict(r) for r in rows]
    
    # Фильтр по контексту
    rows = filter_by_context(rows, context_type, context_value)
    
    # Статистика
    total_vacancies = len(rows)
    # Уникальные группы
    groups_set = set()
    for r in rows:
        prof = r.get('profession')
        if prof:
            g = get_profession_group(prof)
            if g:
                groups_set.add(g)
    total_groups = len(groups_set)
    
    # Зарплатные данные (RUR, 10k-600k)
    salary_data = get_salary_rows(rows)
    salaries = [s for s, _ in salary_data]
    overall_median = statistics.median(salaries) if salaries else None
    
    # pie_data
    pie_data = calculate_pie_data(rows, context_type, context_value)
    
    # median_by_groups
    median_by_groups = calculate_median_by_groups(rows, context_type, context_value)
    
    # distributions
    distributions = calculate_distributions(rows)
    
    # histogram
    histogram = calculate_histogram(salary_data)
    
    # salary_by_experience (медиана по опыту)
    exp_groups = defaultdict(list)
    for s, r in salary_data:
        exp = r.get('experience')
        if exp:
            exp_groups[exp].append(s)
    salary_by_experience = []
    for exp, vals in exp_groups.items():
        if vals:
            salary_by_experience.append({
                "experience": exp,
                "median": statistics.median(vals)
            })
    
    return {
        "stats": {
            "total_vacancies": total_vacancies,
            "total_groups": total_groups
        },
        "context_info": {
            "type": context_type,
            "value": context_value
        },
        "overall_median": overall_median,
        "pie_data": pie_data,
        "median_by_groups": median_by_groups,
        "distributions": distributions,
        "histogram": histogram,
        "salary_by_experience": salary_by_experience
    }

@router.get("/skills/top")
async def get_top_skills(
    context_type: str = Query("all", pattern="^(all|group|profession)$"),
    context_value: str = Query(None),
    limit: int = Query(10)
):
    conn = await get_db()
    cursor = await conn.execute("SELECT profession, key_skills FROM vacancies")
    rows = await cursor.fetchall()
    await conn.close()
    rows = [dict(r) for r in rows]
    rows = filter_by_context(rows, context_type, context_value)
    
    skill_counter = Counter()
    for r in rows:
        skills = parse_skills(r.get('key_skills'))
        skill_counter.update(skills)
    total_vacancies = len(rows)
    top = []
    for skill, cnt in skill_counter.most_common(limit):
        top.append({
            "skill": skill,
            "count": cnt,
            "percentage": round(cnt / total_vacancies * 100, 1) if total_vacancies else 0
        })
    return top

@router.get("/skills/salary-impact")
async def get_salary_impact(
    context_type: str = Query("all", pattern="^(all|group|profession)$"),
    context_value: str = Query(None),
    top_n: int = Query(20)
):
    conn = await get_db()
    cursor = await conn.execute("SELECT profession, key_skills, salary_currency, salary_from, salary_to FROM vacancies")
    rows = await cursor.fetchall()
    await conn.close()
    rows = [dict(r) for r in rows]
    rows = filter_by_context(rows, context_type, context_value)
    
    # Отбираем только зарплатные вакансии RUR с медианой
    salary_rows = []
    for r in rows:
        med = compute_median_salary(r)
        if med is not None and r.get('salary_currency') == 'RUR' and 10000 <= med <= 600000:
            salary_rows.append((med, r))
    
    # Считаем частоту навыков только среди этих вакансий
    skill_counter = Counter()
    for med, r in salary_rows:
        skills = parse_skills(r.get('key_skills'))
        skill_counter.update(skills)
    
    # Берем топ-20 навыков по частоте
    top_skills = [s for s, _ in skill_counter.most_common(top_n)]
    
    result = []
    for skill in top_skills:
        with_skill = []
        without_skill = []
        for med, r in salary_rows:
            skills = parse_skills(r.get('key_skills'))
            if skill in skills:
                with_skill.append(med)
            else:
                without_skill.append(med)
        if len(with_skill) < 5:
            continue
        med_with = statistics.median(with_skill)
        med_without = statistics.median(without_skill) if without_skill else 0
        diff = med_with - med_without
        result.append({
            "skill": skill,
            "median_with": med_with,
            "median_without": med_without,
            "diff": diff
        })
    # Сортируем по модулю разницы
    result.sort(key=lambda x: abs(x['diff']), reverse=True)
    return result[:top_n]

@router.get("/skills/graph")
async def get_skills_graph(
    context_type: str = Query("all", pattern="^(all|group|profession)$"),
    context_value: str = Query(None),
    min_cooccurrence: int = Query(10)
):
    conn = await get_db()
    cursor = await conn.execute("SELECT profession, key_skills FROM vacancies")
    rows = await cursor.fetchall()
    await conn.close()
    rows = [dict(r) for r in rows]
    rows = filter_by_context(rows, context_type, context_value)
    
    # Парсим навыки для каждой вакансии
    skills_per_vacancy = []
    for r in rows:
        skills = parse_skills(r.get('key_skills'))
        if skills:
            skills_per_vacancy.append(set(skills))
    
    # Счетчик частоты навыков
    skill_count = Counter()
    for sset in skills_per_vacancy:
        skill_count.update(sset)
    
    # Построим граф совместной встречаемости
    cooc = defaultdict(Counter)
    for sset in skills_per_vacancy:
        lst = list(sset)
        for i in range(len(lst)):
            for j in range(i+1, len(lst)):
                a, b = lst[i], lst[j]
                cooc[a][b] += 1
                cooc[b][a] += 1
    
    nodes = [{"id": skill, "count": cnt} for skill, cnt in skill_count.items()]
    edges = []
    for a, counters in cooc.items():
        for b, weight in counters.items():
            if a < b and weight >= min_cooccurrence:
                edges.append({"source": a, "target": b, "weight": weight})
    
    return {"nodes": nodes, "edges": edges}