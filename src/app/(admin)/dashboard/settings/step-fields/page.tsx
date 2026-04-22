"use client";

import { useEffect, useState } from "react";
import { StepField } from "@/types/database";
import { Trash2, Plus, Edit2, Save, X, GripVertical } from "lucide-react";

export default function StepFieldsPage() {
  const [fields, setFields] = useState<StepField[]>([]);
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [editingField, setEditingField] = useState<StepField | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [formData, setFormData] = useState({
    field_name: "",
    field_label: "",
    field_type: "text" as StepField["field_type"],
    is_required: true,
    file_types: [] as string[],
    options: null as any,
    placeholder: "",
    help_text: "",
  });

  useEffect(() => {
    loadFields();
  }, [selectedStep]);

  const loadFields = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/step-fields?step=${selectedStep}`);
      const data = await res.json();
      setFields(data.data || []);
    } catch (error) {
      console.error("Error loading fields:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = () => {
    setIsAdding(true);
    setEditingField(null);
    setFormData({
      field_name: "",
      field_label: "",
      field_type: "text",
      is_required: true,
      file_types: [],
      options: null,
      placeholder: "",
      help_text: "",
    });
  };

  const handleEditField = (field: StepField) => {
    setEditingField(field);
    setIsAdding(false);
    setFormData({
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      is_required: field.is_required,
      file_types: field.file_types || [],
      options: field.options,
      placeholder: field.placeholder || "",
      help_text: field.help_text || "",
    });
  };

  const handleSaveField = async () => {
    try {
      const payload = {
        step: selectedStep,
        ...formData,
        sort_order: fields.length + 1,
      };

      let res;
      if (editingField) {
        res = await fetch(`/api/admin/step-fields?id=${editingField.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      } else {
        res = await fetch("/api/admin/step-fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        loadFields();
        setIsAdding(false);
        setEditingField(null);
      }
    } catch (error) {
      console.error("Error saving field:", error);
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الحقل؟")) return;

    try {
      const res = await fetch(`/api/admin/step-fields?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadFields();
      }
    } catch (error) {
      console.error("Error deleting field:", error);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingField(null);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">إدارة حقول الخطوات</h1>
        <p className="text-gray-600">
          تحكم كامل في الأسئلة والحقول لكل خطوة من خطوات التقرير اليومي
        </p>
      </div>

      {/* Step Selector */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {[1, 2, 3, 4, 5, 6].map((step) => (
          <button
            key={step}
            onClick={() => setSelectedStep(step)}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              selectedStep === step
                ? "bg-green-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            الخطوة {step}
          </button>
        ))}
      </div>

      {/* Add Button */}
      <button
        onClick={handleAddField}
        className="mb-6 bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
      >
        <Plus size={20} />
        إضافة حقل جديد
      </button>

      {/* Fields List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">جاري التحميل...</div>
        ) : fields.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            لا توجد حقول في هذه الخطوة
          </div>
        ) : (
          fields.map((field) => (
            <div
              key={field.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition"
            >
              {editingField?.id === field.id ? (
                <FieldForm
                  formData={formData}
                  setFormData={setFormData}
                  onSave={handleSaveField}
                  onCancel={handleCancel}
                />
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <GripVertical size={20} className="text-gray-400" />
                      <h3 className="text-lg font-bold">{field.field_label}</h3>
                      {field.is_required && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                          إجباري
                        </span>
                      )}
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {getFieldTypeLabel(field.field_type)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mr-8">
                      اسم الحقل: <code className="bg-gray-100 px-2 py-1 rounded">{field.field_name}</code>
                    </p>
                    {field.help_text && (
                      <p className="text-sm text-gray-500 mt-2 mr-8">{field.help_text}</p>
                    )}
                    {field.file_types && field.file_types.length > 0 && (
                      <p className="text-sm text-gray-500 mt-1 mr-8">
                        أنواع الملفات: {field.file_types.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditField(field)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteField(field.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add New Field Form */}
      {isAdding && (
        <div className="mt-4 bg-white border-2 border-blue-300 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">إضافة حقل جديد</h3>
          <FieldForm
            formData={formData}
            setFormData={setFormData}
            onSave={handleSaveField}
            onCancel={handleCancel}
          />
        </div>
      )}
    </div>
  );
}

function FieldForm({
  formData,
  setFormData,
  onSave,
  onCancel,
}: {
  formData: any;
  setFormData: any;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">العنوان المعروض</label>
          <input
            type="text"
            value={formData.field_label}
            onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="مثال: رفع ملف المبيعات"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">الاسم التقني</label>
          <input
            type="text"
            value={formData.field_name}
            onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="مثال: sales_pdf"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">نوع الحقل</label>
          <select
            value={formData.field_type}
            onChange={(e) =>
              setFormData({ ...formData, field_type: e.target.value as StepField["field_type"] })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
          >
            <option value="text">نص</option>
            <option value="number">رقم</option>
            <option value="file">ملف</option>
            <option value="select">اختيار من قائمة</option>
            <option value="textarea">نص طويل</option>
            <option value="checkbox">خانة اختيار</option>
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_required}
              onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
              className="w-5 h-5"
            />
            <span className="text-sm font-medium">حقل إجباري</span>
          </label>
        </div>
      </div>

      {formData.field_type === "file" && (
        <div>
          <label className="block text-sm font-medium mb-1">أنواع الملفات المسموحة</label>
          <input
            type="text"
            value={formData.file_types.join(", ")}
            onChange={(e) =>
              setFormData({
                ...formData,
                file_types: e.target.value.split(",").map((t) => t.trim()),
              })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="pdf, jpg, png"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">نص مساعد</label>
        <input
          type="text"
          value={formData.help_text}
          onChange={(e) => setFormData({ ...formData, help_text: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
          placeholder="نص توضيحي يظهر للمستخدم"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
        >
          <X size={18} />
          إلغاء
        </button>
        <button
          onClick={onSave}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
        >
          <Save size={18} />
          حفظ
        </button>
      </div>
    </div>
  );
}

function getFieldTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text: "نص",
    number: "رقم",
    file: "ملف",
    select: "اختيار",
    textarea: "نص طويل",
    checkbox: "خانة اختيار",
  };
  return labels[type] || type;
}
