from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.section import WD_SECTION

OUT = "南京金箔锻制技艺深度调研报告.docx"

NAVY = "17324D"
BLUE = "2E74B5"
INK = "1F2937"
MUTED = "5B6470"
GOLD = "9A6B16"
PALE_BLUE = "E8EEF5"
PALE_GOLD = "F8F1E2"
LIGHT_GRAY = "F3F5F7"
WHITE = "FFFFFF"


def set_cjk_font(run, name="Microsoft YaHei"):
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.rFonts
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    rfonts.set(qn("w:ascii"), "Calibri")
    rfonts.set(qn("w:hAnsi"), "Calibri")
    rfonts.set(qn("w:eastAsia"), name)


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=80, start=120, bottom=80, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for side, val in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{side}"))
        if node is None:
            node = OxmlElement(f"w:{side}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")


def set_table_geometry(table, widths):
    table.autofit = False
    tbl = table._tbl
    tbl_pr = tbl.tblPr
    tbl_w = tbl_pr.first_child_found_in("w:tblW")
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths)))
    tbl_w.set(qn("w:type"), "dxa")
    tbl_ind = tbl_pr.first_child_found_in("w:tblInd")
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), "120")
    tbl_ind.set(qn("w:type"), "dxa")
    grid = tbl.tblGrid
    for grid_col, width in zip(grid.gridCol_lst, widths):
        grid_col.set(qn("w:w"), str(width))
    for row in table.rows:
        for cell, width in zip(row.cells, widths):
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(width))
            tc_w.set(qn("w:type"), "dxa")
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def set_cell_text(cell, text, size=9.5, bold=False, color=INK):
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.12
    r = p.add_run(text)
    set_cjk_font(r)
    r.font.size = Pt(size)
    r.font.color.rgb = RGBColor.from_string(color)
    r.bold = bold


def add_hyperlink(paragraph, text, url, color=BLUE, size=None):
    part = paragraph.part
    r_id = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), r_id)
    new_run = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    rfonts = OxmlElement("w:rFonts")
    rfonts.set(qn("w:ascii"), "Calibri")
    rfonts.set(qn("w:hAnsi"), "Calibri")
    rfonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    rpr.append(rfonts)
    c = OxmlElement("w:color")
    c.set(qn("w:val"), color)
    rpr.append(c)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    rpr.append(underline)
    if size is not None:
        point_size = str(round(size * 2))
        sz = OxmlElement("w:sz")
        sz.set(qn("w:val"), point_size)
        rpr.append(sz)
        sz_cs = OxmlElement("w:szCs")
        sz_cs.set(qn("w:val"), point_size)
        rpr.append(sz_cs)
    new_run.append(rpr)
    t = OxmlElement("w:t")
    t.text = text
    new_run.append(t)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def add_page_field(paragraph):
    run = paragraph.add_run()
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr)
    run._r.append(fld_char2)
    set_cjk_font(run)
    run.font.size = Pt(8.5)
    run.font.color.rgb = RGBColor.from_string(MUTED)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def add_rule(paragraph, color="D8E0E8"):
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "8")
    bottom.set(qn("w:color"), color)
    p_bdr.append(bottom)
    p_pr.append(p_bdr)


def add_heading(doc, text, level=1):
    p = doc.add_paragraph(style=f"Heading {level}")
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    set_cjk_font(r)
    return p


def add_body(doc, text, bold_lead=None):
    p = doc.add_paragraph(style="Normal")
    if bold_lead and text.startswith(bold_lead):
        r = p.add_run(bold_lead)
        set_cjk_font(r)
        r.bold = True
        r.font.color.rgb = RGBColor.from_string(INK)
        r2 = p.add_run(text[len(bold_lead):])
        set_cjk_font(r2)
    else:
        r = p.add_run(text)
        set_cjk_font(r)
    return p


def add_bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    r = p.add_run(text)
    set_cjk_font(r)
    return p


def add_number(doc, text):
    p = doc.add_paragraph(style="List Number")
    r = p.add_run(text)
    set_cjk_font(r)
    return p


def make_table(doc, headers, rows, widths):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.style = "Table Grid"
    set_table_geometry(table, widths)
    set_repeat_table_header(table.rows[0])
    for i, text in enumerate(headers):
        shade(table.rows[0].cells[i], PALE_BLUE)
        set_cell_text(table.rows[0].cells[i], text, size=9.5, bold=True, color=NAVY)
    for row_idx, row in enumerate(rows):
        cells = table.add_row().cells
        for i, text in enumerate(row):
            if row_idx % 2 == 1:
                shade(cells[i], "FAFBFC")
            set_cell_text(cells[i], text)
    return table


def add_case(doc, no, title, kind, finding, takeaway, source_label, source_url, source_note=None):
    p = doc.add_paragraph(style="Heading 3")
    p.paragraph_format.space_before = Pt(9)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(f"{no}. {title}")
    set_cjk_font(r)
    r.font.color.rgb = RGBColor.from_string(NAVY)
    p1 = doc.add_paragraph(style="Normal")
    lead = p1.add_run("形态：")
    set_cjk_font(lead)
    lead.bold = True
    r = p1.add_run(kind)
    set_cjk_font(r)
    p1.paragraph_format.keep_with_next = True
    p2 = doc.add_paragraph(style="Normal")
    lead = p2.add_run("可核验功能：")
    set_cjk_font(lead)
    lead.bold = True
    r = p2.add_run(finding)
    set_cjk_font(r)
    p2.paragraph_format.keep_with_next = True
    p3 = doc.add_paragraph(style="Normal")
    lead = p3.add_run("对金箔项目的启示：")
    set_cjk_font(lead)
    lead.bold = True
    r = p3.add_run(takeaway)
    set_cjk_font(r)
    p3.paragraph_format.keep_with_next = True
    p4 = doc.add_paragraph(style="Normal")
    p4.paragraph_format.space_after = Pt(5)
    label = p4.add_run("来源：")
    set_cjk_font(label)
    add_hyperlink(p4, source_label, source_url)
    if source_note:
        note = p4.add_run(f"（{source_note}）")
        set_cjk_font(note)
        note.font.color.rgb = RGBColor.from_string(MUTED)


doc = Document()
section = doc.sections[0]
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
section.left_margin = Inches(1)
section.right_margin = Inches(1)
section.header_distance = Inches(0.492)
section.footer_distance = Inches(0.492)

# Preset: standard_business_brief. CJK font override: Microsoft YaHei.
styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Calibri"
normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
normal.font.size = Pt(11)
normal.font.color.rgb = RGBColor.from_string(INK)
normal.paragraph_format.space_before = Pt(0)
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.line_spacing = 1.10

for style_name, size, color, before, after in [
    ("Heading 1", 16, BLUE, 16, 8),
    ("Heading 2", 13, BLUE, 12, 6),
    ("Heading 3", 12, NAVY, 8, 4),
]:
    st = styles[style_name]
    st.font.name = "Calibri"
    st._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    st.font.size = Pt(size)
    st.font.color.rgb = RGBColor.from_string(color)
    st.font.bold = True
    st.paragraph_format.space_before = Pt(before)
    st.paragraph_format.space_after = Pt(after)
    st.paragraph_format.line_spacing = 1.10

for style_name in ["List Bullet", "List Number"]:
    st = styles[style_name]
    st.font.name = "Calibri"
    st._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    st.font.size = Pt(11)
    st.paragraph_format.space_after = Pt(4)
    st.paragraph_format.line_spacing = 1.10

# Running furniture.
header_p = section.header.paragraphs[0]
header_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
header_p.paragraph_format.space_after = Pt(2)
header_run = header_p.add_run("南京金箔锻制技艺｜深度调研报告")
set_cjk_font(header_run)
header_run.font.size = Pt(8.5)
header_run.font.color.rgb = RGBColor.from_string(MUTED)
add_rule(header_p)

footer_p = section.footer.paragraphs[0]
footer_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
footer_run = footer_p.add_run("调研日期：2026 年 8 月 11 日　|　第 ")
set_cjk_font(footer_run)
footer_run.font.size = Pt(8.5)
footer_run.font.color.rgb = RGBColor.from_string(MUTED)
add_page_field(footer_p)
end = footer_p.add_run(" 页")
set_cjk_font(end)
end.font.size = Pt(8.5)
end.font.color.rgb = RGBColor.from_string(MUTED)

# Cover.
doc.add_paragraph().paragraph_format.space_after = Pt(42)
kicker = doc.add_paragraph()
kicker.alignment = WD_ALIGN_PARAGRAPH.CENTER
kicker.paragraph_format.space_after = Pt(12)
r = kicker.add_run("非遗文化与数字传播研究简报")
set_cjk_font(r)
r.font.size = Pt(11)
r.font.bold = True
r.font.color.rgb = RGBColor.from_string(GOLD)

title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
title.paragraph_format.space_after = Pt(10)
r = title.add_run("南京金箔锻制技艺\n深度调研报告")
set_cjk_font(r)
r.font.size = Pt(28)
r.font.bold = True
r.font.color.rgb = RGBColor.from_string(NAVY)

subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
subtitle.paragraph_format.space_after = Pt(30)
r = subtitle.add_run("面向金箔非遗文化传承微信小程序的内容扩展与互动设计")
set_cjk_font(r)
r.font.size = Pt(13)
r.font.color.rgb = RGBColor.from_string(MUTED)

meta = doc.add_table(rows=1, cols=3)
meta.alignment = WD_TABLE_ALIGNMENT.CENTER
set_table_geometry(meta, [3120, 3120, 3120])
for cell, label, value in zip(meta.rows[0].cells, ["调研对象", "案例范围", "交付内容"], ["南京金箔锻制技艺", "10 个非遗/文化遗产数字案例", "内容架构、素材建议、互动任务、来源清单"]):
    shade(cell, PALE_BLUE)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(2)
    a = p.add_run(label)
    set_cjk_font(a)
    a.bold = True
    a.font.size = Pt(9.5)
    a.font.color.rgb = RGBColor.from_string(NAVY)
    p2 = cell.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.paragraph_format.space_after = Pt(0)
    b = p2.add_run(value)
    set_cjk_font(b)
    b.font.size = Pt(9.5)
    b.font.color.rgb = RGBColor.from_string(INK)

note = doc.add_paragraph()
note.alignment = WD_ALIGN_PARAGRAPH.CENTER
note.paragraph_format.space_before = Pt(26)
note.paragraph_format.space_after = Pt(0)
r = note.add_run("本报告基于公开可核验资料整理；事实、地方传说与设计推断均作区分。")
set_cjk_font(r)
r.font.size = Pt(10)
r.font.color.rgb = RGBColor.from_string(MUTED)
doc.add_page_break()

add_heading(doc, "一、执行摘要", 1)
add_body(doc, "南京金箔锻制技艺具有完整的工序体系、明确的国家级非遗身份，以及可被继续利用的地方档案与传承人数字化记录。与其将小程序做成单纯的金色视觉展览，更合适的方向是“工艺闯关 + 人物档案 + 城市文化应用”的学习体验：让用户先看见一片金箔如何诞生，再理解手艺、传承人与当代生活之间的关系。")
add_body(doc, "核心建议：第一期以可信知识、五步任务和轻量素材为主；高成本全景工厂、AI 数字人和电商转化应在资料授权、内容验证和用户需求明确后再考虑。")

add_heading(doc, "二、调研范围与方法", 1)
add_body(doc, "检索时间为 2026 年 8 月 11 日。资料优先级依次为：国家级非遗平台、南京地方政府与档案机构、博物馆/文化机构、公开学术资料；案例则采用能核验功能形态的官方网站、政府公开页或项目方页面。")
add_bullet(doc, "纳入：与南京金箔的名录、工序、保护、数字化记录直接相关的公开资料；以及可复用到非遗小程序的数字展陈案例。")
add_bullet(doc, "排除：无法追溯来源的营销文章、仅有截图而没有公开说明的案例，以及将地方传说当作确定史实的材料。")
add_bullet(doc, "限制：未直接进入每个微信小程序的实时界面；案例功能可能更新、下线或区域受限，报告只描述公开页面能核验的内容。")

add_heading(doc, "三、南京金箔锻制技艺：可采用的事实基线", 1)
facts = [
    ("非遗身份", "国家级非遗代表性项目，项目编号Ⅷ-36，2006 年公布，类别为传统技艺；申报地区为江苏省南京市。", "S1"),
    ("工艺主线", "公开项目资料列出倒条、下条、拍叶、做捻子、打开子、装家生、打了戏、出具、切金箔、检验包装等十多道工序。", "S1"),
    ("量级理解", "官方资料以“约 0.1 微米”和“943 张约 1 毫米厚”帮助理解金箔之薄；适宜用于科普，不应包装为唯一工艺验收标准。", "S1"),
    ("传承与档案", "南京市档案馆已接收并数字化 730 卷、9000 余件相关档案及部分影像资料；南京也已完成王必生的数字化记录工程。", "S2、S3"),
    ("叙事边界", "葛仙翁、葛洪等内容属于官方资料明确记载的地方传说；应与《天工开物》等文字记录、现代档案分层呈现。", "S1"),
]
make_table(doc, ["维度", "报告结论", "来源"], facts, [1600, 6560, 1200])

add_heading(doc, "四、内容架构建议", 1)
add_body(doc, "以下为面向微信小程序的内容架构建议，属于基于资料与案例的设计推断，并非既定产品功能。")
architecture = [
    ("首页：一片金箔的旅程", "主视觉、继续学习、今日知识", "快速进入并建立学习动机"),
    ("金箔知事", "名录、龙潭、术语、传说与史料辨析", "回答“它是什么、从哪里来”"),
    ("匠作工坊", "逐步工艺卡、局部短片、任务", "把抽象技艺转为可理解的动作"),
    ("传承与档案", "传承人、工具、口述史、档案时间线", "把“人”和“资料”纳入核心叙事"),
    ("金箔在生活中", "建筑、艺术、修复、当代设计", "建立工艺的当代意义"),
    ("学习手册", "进度、错题、收藏词条、作品记录", "形成学习闭环"),
    ("线下延展（可选）", "活动、展馆、体验信息", "连接真实传承场景"),
]
make_table(doc, ["模块", "内容", "用户价值"], architecture, [2450, 3650, 3260])

add_heading(doc, "五、页面素材与表述建议", 1)
materials = [
    ("首页", "获授权的金箔微距照片或自制纹理；极短锤击声音", "不将未经许可的工厂片、传承人影像作为背景素材"),
    ("工序页", "单步工具/动作图、10–20 秒局部短片、术语解释", "避免以长视频代替解释，或伪造精确物理模拟"),
    ("档案页", "时间轴、档案编号、资料类型、口述摘录", "传说必须有显著标签，不进入确定史实时间轴"),
    ("传承人页", "确认后的姓名、工种、公开采访片段", "避免扩写未经证实的生平、师承或获奖"),
    ("应用页", "授权的建筑、艺术、修复案例", "商品、品牌、博物馆图片均需单独确认权利"),
]
make_table(doc, ["页面", "建议素材", "边界"], materials, [1500, 4100, 3760])

doc.add_page_break()
add_heading(doc, "六、互动任务设计", 1)
tasks = [
    ("做捻子", "把金叶与纸层按顺序组合", "理解工艺包含多层准备"),
    ("装家生", "在有限格位中安排材料层次", "理解承载与保护材料的概念"),
    ("打箔节奏", "点击或滑动完成节奏片段", "体会重复劳动与协作，不把它做成纯拼手速"),
    ("出具检查", "识别厚薄不均、破损或边缘问题", "强调质量控制也是工艺的一部分"),
    ("切箔", "按边界完成轻量分割", "以平整度与检验反馈代替夸张破碎效果"),
    ("工序排序", "将十余道工序归位", "建立整体流程记忆"),
    ("数据实验室", "滑杆比较约 0.1 微米、943 张约 1 毫米等量级", "将抽象厚度变得可感知，明确标注来源"),
]
make_table(doc, ["任务", "交互", "学习目标"], tasks, [1600, 4050, 3710])

add_heading(doc, "七、10 个数字案例与可复用经验", 1)
add_body(doc, "前 7 个为直接非遗数字化案例；后 3 个为文化遗产数字体验案例，用于参考导览、服务与无障碍设计。")
add_case(doc, 1, "中国非物质文化遗产网·中国非遗数字博物馆", "国家级资源与展览平台", "提供非遗项目、传承人与展览等资源入口。", "作为金箔内容的事实校验和术语来源；不必复制大而全的全国目录。", "中国非遗数字博物馆", "https://www.ihchina.cn/index.html/")
add_case(doc, 2, "浙江“数字非遗”工程", "省级数字化保护与传播体系", "公开资料提及非遗数据仓、项目/传承人信息、知识图谱和新媒体传播矩阵。", "后期可将工序、人物、地域和用途做轻量关联；第一期无需开发复杂知识图谱。", "文化和旅游部", "https://www.mct.gov.cn/wlbphone/wlbydd/xxfb/qglb/zj/202108/t20210826_927366.html")
add_case(doc, 3, "“福见非遗”小程序", "省级非遗服务小程序", "公开资料提及非遗资源、展馆、工坊、购物和旅游等板块。", "内容、体验和服务可共存；金箔项目应先完成知识与工艺体验，再考虑交易功能。", "福建省人民政府", "https://www.fujian.gov.cn/zwgk/zdlyxxgk/jytabl_1/202407/t20240715_6483872.htm")
add_case(doc, 4, "“老家河南·黄河之礼”非遗数字馆", "微信小程序", "手绘地图、全景博物馆、语音、短视频、传承人名片、文创与互动小游戏。", "最值得借鉴的是“探索—全景—传习—礼物”的完整体验线。", "中国非物质文化遗产网", "https://www.ihchina.cn/art/detail/id/22101.html")
add_case(doc, 5, "泥人张彩塑文化小程序", "单项非遗微信小程序", "项目方公开介绍展览、故事、3D 数字展厅、商城、扫码互动和教育。", "单一工艺可通过“作品—工序—故事”聚焦；仅可据此参考公开声明的功能，不推断运营效果。", "项目方案例页", "https://mudtrace.com/cases", "项目方自述")
add_case(doc, 6, "“物以载道——中国非遗数字展”", "线上 3D 数字展览", "以三个主题板块组织茶、瓷器、丝绸、家具、佛山非遗和文创资源。", "金箔可按“锤炼”“贴金”“当代新生”组织主题，而不是按素材类型堆叠。", "中国驻摩洛哥使馆", "https://ma.china-embassy.gov.cn/chn/tpxw/202011/t20201103_6159876.htm")
add_case(doc, 7, "苏州非遗 VR 虚拟展厅", "720° 虚拟展陈", "以全景场景、图文说明与局部三维展示组织线下展厅。", "可选择工具或局部空间做轻量全景/三维，不必制作高成本全流程工厂漫游。", "苏州非遗信息网", "https://szfy.wglj.suzhou.com.cn/tszt")
add_case(doc, 8, "中国传统村落数字博物馆小程序", "传统村落数字博物馆与小程序", "公开介绍包含全景馆、历史文化、非遗文化和口述历史内容。", "“龙潭—工坊—传承”的空间线索可与口述史结合，避免孤立百科页。", "中国传统村落数字博物馆", "https://www.dmctv.cn/zxShow.aspx?id=1256")
add_case(doc, 9, "云游敦煌", "文化遗产微信小程序", "敦煌研究院公开资料说明其于 2020 年推出，并将线上探索、游览与保护叙事结合。", "用一个文化对象串联探索、保护和文创，不应将学习与服务拆成无关页面。", "敦煌研究院", "https://www.dunhuangcaves.org/info/1085/1922.htm")
add_case(doc, 10, "数字故宫", "博物馆微信小程序", "公开资料介绍全景漫游、路线、语音、AR 导览、无障碍与线上线下参观服务。", "后期可借鉴不同学习路线、读屏支持和线上线下融合；不必复制复杂 AR 导航。", "故宫博物院", "https://www.dpm.org.cn/classify_detail/257034.html")

add_heading(doc, "八、实施优先级", 1)
add_heading(doc, "优先完成", 2)
for item in [
    "经核验的工艺知识卡、术语体系和来源标签。",
    "围绕做捻子、装家生、打箔、出具检查、切箔的学习任务与复盘。",
    "传承人、地方档案、工具和故事的分层叙事。",
    "轻量图片、音频、短视频与文本，先建立高质量内容资产。",
    "事实、地方传说、设计推断的明显区分。",
]:
    add_number(doc, item)
add_heading(doc, "建议暂缓", 2)
for item in [
    "全流程高精度 3D 工厂漫游。",
    "未经授权的传承人 AI 数字人、语音或肖像化互动。",
    "与学习目标无关的商城、排行榜和强制分享。",
    "将工艺参数包装为唯一正确配方。",
    "直接抓取博物馆、纪录片、企业或品牌素材。",
]:
    add_bullet(doc, item)

add_heading(doc, "九、版权、授权与伦理提示", 1)
add_body(doc, "《中华人民共和国非物质文化遗产法》强调记录、建档、传承与传播；这支持基于事实的数字化科普，但并不意味着公开页面上的图片、视频、人物声音可以直接用于产品。著作权与信息网络传播权仍需按具体作品和授权范围判断。", bold_lead="《中华人民共和国非物质文化遗产法》")
rights = [
    ("官方网页文字", "自行改写并标注来源；避免大段复制"),
    ("图片、视频、音频", "确认权利方、使用范围、期限、是否允许二次编辑与商业化"),
    ("传承人肖像、声音、采访", "取得本人或保护单位确认；AI 语音/形象须单独约定"),
    ("企业品牌与车间", "确认商标、商业宣传与拍摄使用授权"),
    ("用户上传作品", "明确展示授权、未成年人保护、投诉与下架流程"),
]
make_table(doc, ["素材/信息类型", "上线前应完成"], rights, [3300, 6060])
p = doc.add_paragraph(style="Normal")
r = p.add_run("相关法律与规范：")
set_cjk_font(r)
r.bold = True
add_hyperlink(p, "《中华人民共和国非物质文化遗产法》", "https://www.npc.gov.cn/npc/c2/c12435/c12488/201905/t20190522_70066.html")
r = p.add_run("；")
set_cjk_font(r)
add_hyperlink(p, "《中华人民共和国著作权法》", "https://www.npc.gov.cn/c2/c30834/202011/t20201119_308796.html")
r = p.add_run("。本节为产品风险提示，不构成正式法律意见。")
set_cjk_font(r)

add_heading(doc, "十、来源与参考链接", 1)
sources = [
    ("S1", "中国非物质文化遗产网·中国非物质文化遗产数字博物馆：《南京金箔锻制技艺》", "https://www.ihchina.cn/project_details/14324.html"),
    ("S2", "南京市档案馆：《南京市档案馆积极推动金箔非遗档案的收集整理工作》", "https://dag.nanjing.gov.cn/gzdt/202303/t20230324_3871607.html"),
    ("S3", "南京市人民政府：《对市政协十四届四次会议第0206号提案的答复》", "https://www.nanjing.gov.cn/xxgkn/jytabl_1/2021njytabl/shizxta/202112/t20211207_3223991.html"),
    ("S4", "南京市人民政府：《南京非遗走进央视〈非遗里的中国〉》", "https://www.nanjing.gov.cn/zzb/ywdt/bmdt_72661/202305/t20230508_3905829.html"),
    ("S5", "中国非物质文化遗产网·中国非物质文化遗产数字博物馆：首页", "https://www.ihchina.cn/index.html/"),
    ("S6", "文化和旅游部：《浙江省“数字非遗”工程赋能高质量美好生活》", "https://www.mct.gov.cn/wlbphone/wlbydd/xxfb/qglb/zj/202108/t20210826_927366.html"),
    ("S7", "福建省人民政府：《关于省政协十三届二次会议20242240号提案的答复》", "https://www.fujian.gov.cn/zwgk/zdlyxxgk/jytabl_1/202407/t20240715_6483872.htm"),
    ("S8", "中国非物质文化遗产网：《“老家河南 黄河之礼”非遗数字馆小程序上线仪式在河南禹州市举办》", "https://www.ihchina.cn/art/detail/id/22101.html"),
    ("S9", "津门泥溯：泥人张彩塑文化小程序案例页", "https://mudtrace.com/cases"),
    ("S10", "中华人民共和国驻摩洛哥王国大使馆：《“物以载道——中国非遗数字展”在中国和摩洛哥上线》", "https://ma.china-embassy.gov.cn/chn/tpxw/202011/t20201103_6159876.htm"),
    ("S11", "苏州非物质文化遗产信息网：非一般的展厅", "https://szfy.wglj.suzhou.com.cn/tszt"),
    ("S12", "中国传统村落数字博物馆：传统村落数字博物馆官方小程序正式上线", "https://www.dmctv.cn/zxShow.aspx?id=1256"),
    ("S13", "敦煌研究院：融媒体中心", "https://www.dunhuangcaves.org/info/1085/1922.htm"),
    ("S14", "故宫博物院：《“数字故宫”小程序2.0正式发布》", "https://www.dpm.org.cn/classify_detail/257034.html"),
    ("S15", "中国人大网：《中华人民共和国非物质文化遗产法》", "https://www.npc.gov.cn/npc/c2/c12435/c12488/201905/t20190522_70066.html"),
    ("S16", "中国人大网：《中华人民共和国著作权法》", "https://www.npc.gov.cn/c2/c30834/202011/t20201119_308796.html"),
    ("S17", "中国期刊全文数据库：《非遗活化视角下南京金箔艺术设计策略分析》", "https://cnki.istiz.org.cn/kcms/detail/detail.aspx?dbcode=CJFD&dbname=CJFD2025&filename=ZWXE202521027"),
]
for code, label, url in sources:
    p = doc.add_paragraph(style="Normal")
    p.paragraph_format.left_indent = Inches(0.05)
    p.paragraph_format.first_line_indent = Inches(-0.05)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    r = p.add_run(f"{code}  ")
    set_cjk_font(r)
    r.bold = True
    r.font.size = Pt(9)
    r.font.color.rgb = RGBColor.from_string(NAVY)
    add_hyperlink(p, label, url, size=9)

add_heading(doc, "附：使用说明", 1)
add_body(doc, "本报告用于内容策划、设计沟通与素材授权准备。进入界面设计或开发前，建议先由项目负责人确认：第一期目标用户、是否接入线下体验、可用素材权利范围，以及传承人/保护单位的协作方式。")
disclosure = doc.add_paragraph()
disclosure.paragraph_format.space_before = Pt(12)
disclosure.paragraph_format.space_after = Pt(0)
r = disclosure.add_run("AI 使用说明：")
set_cjk_font(r)
r.bold = True
r.font.color.rgb = RGBColor.from_string(MUTED)
r = disclosure.add_run("本报告由 AI 协助完成公开资料检索、来源核验、案例综合与文稿整理；核心事实均尽量链接至原始或机构来源，案例功能以公开页面可见信息为限。")
set_cjk_font(r)
r.font.size = Pt(9)
r.font.color.rgb = RGBColor.from_string(MUTED)

doc.save(OUT)
print(OUT)
