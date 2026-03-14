// Tính toán cơ bản
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function analyzeDataAndRecommend(variables, rows, selectedTargetId = null) {
  const recommendations = [];
  let autoResults = null;

  const validVars = variables.filter(v => v.type !== 'image' && v.type !== 'id' && v.type !== 'name');
  
  if (validVars.length === 0) return { recommendations: [{ model: "Chưa đủ dữ liệu", reason: "Cần thêm biến số/phân loại." }], autoResults };

  if (!selectedTargetId) {
    // Không chọn Target -> Khuyên dùng EDA / PCA
    recommendations.push({
      model: "Phân tích khám phá (EDA) & Tương quan",
      reason: "Bạn chưa chọn biến phụ thuộc. Hãy sử dụng ma trận tương quan để xem xét mối liên hệ giữa các biến hiện tại.",
      confidence: 0.9
    });

    // Auto Run: Tính trung bình các biến số
    const stats = {};
    validVars.filter(v => v.type === 'number').forEach(v => {
      const data = rows.map(r => Number(r[v.id])).filter(n => !isNaN(n));
      stats[v.name] = { mean: mean(data).toFixed(2), count: data.length };
    });
    autoResults = { title: "Thống kê mô tả (Tự động)", data: stats };

    return { recommendations, autoResults };
  }

  const targetVar = variables.find(v => v.id === selectedTargetId);
  const predictors = validVars.filter(v => v.id !== selectedTargetId);

  if (targetVar.type === 'binary' || targetVar.type === 'categorical') {
    recommendations.push({
      model: "Hồi quy Logistic (Logistic Regression)",
      reason: `Biến mục tiêu "${targetVar.name}" là phân loại/nhị phân. Hồi quy logistic giúp dự đoán xác suất rơi vào các nhóm.`,
      confidence: 0.95
    });
    // Giả lập Auto Run
    autoResults = { title: "Phân bổ phân loại", data: `Biến ${targetVar.name} cần chạy Logistic.` };
  } 
  else if (targetVar.type === 'number') {
    const numPredictors = predictors.filter(p => p.type === 'number');
    if (numPredictors.length === 1) {
      recommendations.push({
        model: "Hồi quy tuyến tính đơn (Simple Linear Regression)",
        reason: "Chỉ có 1 biến độc lập liên tục tác động lên 1 biến phụ thuộc liên tục.",
        confidence: 0.95
      });
    } else if (numPredictors.length > 1) {
      recommendations.push({
        model: "Hồi quy tuyến tính đa biến (Multiple Linear Regression)",
        reason: `Dùng ${numPredictors.length} biến số để dự đoán ${targetVar.name}.`,
        confidence: 0.9
      });
    }

    if (predictors.some(p => p.type === 'categorical')) {
      recommendations.push({
        model: "ANOVA / ANCOVA",
        reason: "Có sự xuất hiện của biến phân loại độc lập tác động đến biến phụ thuộc liên tục.",
        confidence: 0.85
      });
    }
  }

  return { recommendations, autoResults };
}