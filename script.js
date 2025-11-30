// 全局变量
let students = [];
let communications = [];
let currentPeriod = 'total';

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    updateStats();
    checkOverdue();
    updateStatsTable();
    updateLastUpdate();
    
    // 添加标签页切换事件
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentPeriod = e.target.dataset.period;
            updateStatsTable();
        });
    });
});

// 加载CSV数据
async function loadData() {
    try {
        students = await loadCSV('data/students.csv');
        communications = await loadCSV('data/communications.csv');
        
        // 转换日期格式
        communications.forEach(comm => {
            comm.date = new Date(comm.date);
        });
        
        // 按日期排序
        communications.sort((a, b) => b.date - a.date);
    } catch (error) {
        console.error('加载数据失败:', error);
        alert('加载数据失败，请检查CSV文件是否存在且格式正确。');
    }
}

// 加载CSV文件
async function loadCSV(filename) {
    const response = await fetch(filename);
    if (!response.ok) {
        // 如果文件不存在，返回空数组
        if (response.status === 404) {
            return [];
        }
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    return parseCSV(text);
}

// 解析CSV文本
function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        
        // 映射中文表头到英文属性名
        headers.forEach((header, index) => {
            let propName = header;
            // 根据表头内容映射到标准属性名
            if (header === '姓名') propName = 'name';
            if (header === '类型') propName = 'type';
            if (header === '日期') propName = 'date';
            
            obj[propName] = values[index] || '';
        });
        
        return obj;
    });
}

// 更新统计概览
function updateStats() {
    const totalStudents = students.length;
    const totalGraduates = students.filter(s => s.type === '研究生').length;
    const totalUndergraduates = students.filter(s => s.type === '本科生').length;
    
    // 计算真正超时的学生数量（超过标准天数）
    const allOverdueStudents = getOverdueStudents();
    const overdueCount = allOverdueStudents.filter(student => student.daysOverdue > 0).length;
    
    document.getElementById('totalStudents').textContent = totalStudents;
    document.getElementById('totalGraduates').textContent = totalGraduates;
    document.getElementById('totalUndergraduates').textContent = totalUndergraduates;
    document.getElementById('overdueStudents').textContent = overdueCount;
}

// 检查超时未交流的学生
function checkOverdue() {
    const allStudents = getOverdueStudents();
    
    // 筛选出超过标准天数的学生
    const graduateOverdue = allStudents.filter(s => 
        s.type === '研究生' && s.totalDaysSinceLastComm > 14
    );
    
    const undergraduateOverdue = allStudents.filter(s => 
        s.type === '本科生' && s.totalDaysSinceLastComm > 30
    );
    
    updateOverdueList('graduateOverdueList', graduateOverdue);
    updateOverdueList('undergraduateOverdueList', undergraduateOverdue);
}

// 获取超时未交流的学生列表
function getOverdueStudents() {
    // 使用当前系统日期
    const today = new Date();
    const overdueStudents = [];
    
    students.forEach(student => {
        // 筛选该学生的所有交流记录
        const studentCommunications = communications.filter(c => c.name === student.name);
        let lastCommDate = null;
        
        if (studentCommunications.length > 0) {
            // 找到最近的交流记录
            const latestComm = studentCommunications.reduce((latest, current) => {
                return current.date > latest.date ? current : latest;
            });
            lastCommDate = latestComm.date;
        }
        
        // 计算总天数差
        let totalDaysSinceLastComm = 0;
        if (lastCommDate) {
            // 计算从上次交流到今天的天数差
            const diffTime = today - lastCommDate;
            totalDaysSinceLastComm = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } else {
            // 从未交流过，使用一个很大的天数
            totalDaysSinceLastComm = 999;
        }
        
        // 计算实际超时天数（超过标准天数的部分）
        let daysOverdue = 0;
        if (student.type === '研究生') {
            // 研究生标准：14天
            daysOverdue = Math.max(0, totalDaysSinceLastComm - 14);
        } else {
            // 本科生标准：30天
            daysOverdue = Math.max(0, totalDaysSinceLastComm - 30);
        }
        
        // 所有学生都加入列表，用于显示不同颜色标记
        overdueStudents.push({
            ...student,
            lastCommDate: lastCommDate,
            daysOverdue: daysOverdue,
            totalDaysSinceLastComm: totalDaysSinceLastComm
        });
    });
    
    return overdueStudents;
}

// 获取超时天数的颜色类
function getOverdueColorClass(studentType, daysOverdue, totalDaysSinceLastComm) {
    // 研究生颜色逻辑
    if (studentType === '研究生') {
        if (totalDaysSinceLastComm <= 14 + 7) return 'overdue-green';
        if (totalDaysSinceLastComm <= 14 + 14) return 'overdue-yellow';
        return 'overdue-red';
    } 
    // 本科生颜色逻辑
    else {
        if (totalDaysSinceLastComm <= 30 + 15) return 'overdue-green';
        if (totalDaysSinceLastComm <= 30 + 30) return 'overdue-yellow';
        return 'overdue-red';
    }
}

// 更新超时学生列表
function updateOverdueList(containerId, overdueStudents) {
    const container = document.getElementById(containerId);
    
    if (overdueStudents.length === 0) {
        container.innerHTML = '<tr><td colspan="3" class="empty-state">暂无超时学生</td></tr>';
        return;
    }
    
    container.innerHTML = overdueStudents.map(student => {
        const colorClass = getOverdueColorClass(student.type, student.daysOverdue, student.totalDaysSinceLastComm);
        return `
            <tr>
                <td>${student.name}</td>
                <td>${student.lastCommDate ? formatDate(student.lastCommDate) : '从未交流'}</td>
                <td class="${colorClass}">${student.daysOverdue}天</td>
            </tr>
        `;
    }).join('');
}

// 更新统计表格
function updateStatsTable() {
    const container = document.getElementById('statsTableBody');
    const statsData = getStatsByPeriod(currentPeriod);
    
    if (statsData.length === 0) {
        container.innerHTML = '<tr><td colspan="4" class="empty-state">暂无数据</td></tr>';
        return;
    }
    
    container.innerHTML = statsData.map(stat => `
        <tr>
            <td>${stat.name}</td>
            <td>${stat.type}</td>
            <td>${stat.count}</td>
            <td>${stat.lastComm ? formatDate(stat.lastComm) : '从未交流'}</td>
        </tr>
    `).join('');
}

// 根据时间段获取统计数据
function getStatsByPeriod(period) {
    const today = new Date();
    let startDate = null;
    
    switch (period) {
        case 'year':
            startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
            break;
        case 'halfyear':
            startDate = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
            break;
        case 'month':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
            break;
        default: // total
            startDate = new Date(0);
    }
    
    return students.map(student => {
        const studentCommunications = communications.filter(c => 
            c.name === student.name && c.date >= startDate
        );
        
        let lastComm = null;
        if (studentCommunications.length > 0) {
            lastComm = new Date(Math.max(...studentCommunications.map(c => c.date)));
        }
        
        return {
            name: student.name,
            type: student.type,
            count: studentCommunications.length,
            lastComm: lastComm
        };
    }).sort((a, b) => b.count - a.count);
}

// 格式化日期
function formatDate(date) {
    if (!date) return '-';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 更新最后更新时间
function updateLastUpdate() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleString('zh-CN');
}

// 辅助函数：获取当前日期字符串
function getCurrentDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}