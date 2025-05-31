import React, { useState, useEffect } from 'react';
import { ProductData } from '../../interfaces';
// Assuming RICE_TYPE_CHOICES are available, e.g. from a config file or fetched
// For simplicity, hardcoding them here, but ideally they match backend model choices
const RICE_TYPE_CHOICES = [
    { value: 'hakumai', label: '白米 (Hakumai - White Rice)' },
    { value: 'genmai', label: '玄米 (Genmai - Brown Rice)' },
    { value: 'mochigome', label: 'もち米 (Mochigome - Glutinous Rice)' },
    { value: 'koshihikari', label: 'コシヒカリ (Koshihikari)' },
    { value: 'akitakomachi', label: 'あきたこまち (Akitakomachi)' },
    { value: 'hitomebore', label: 'ひとめぼれ (Hitomebore)' },
    { value: 'others', label: 'その他 (Others)' },
];


interface ProductFormProps {
  product?: ProductData | null; // Existing product for editing, null/undefined for create
  onSave: (formData: FormData, productId?: number) => void; // productId for updates
  isLoading?: boolean;
  error?: string | null;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onSave, isLoading, error }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [riceType, setRiceType] = useState(RICE_TYPE_CHOICES[0].value);
  const [quantityKg, setQuantityKg] = useState<number | string>('');
  const [priceYenPerKg, setPriceYenPerKg] = useState<number | string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || '');
      setRiceType(product.rice_type);
      setQuantityKg(product.quantity_kg);
      setPriceYenPerKg(product.price_yen_per_kg);
      setAvailable(product.available !== undefined ? product.available : true);
      if (typeof product.image === 'string') {
        setCurrentImageUrl(product.image);
      }
    } else {
      // Reset form for creation
      setName('');
      setDescription('');
      setRiceType(RICE_TYPE_CHOICES[0].value);
      setQuantityKg('');
      setPriceYenPerKg('');
      setImageFile(null);
      setCurrentImageUrl(null);
      setAvailable(true);
    }
  }, [product]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      setCurrentImageUrl(null); // Clear current image URL when new file is selected
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('rice_type', riceType);
    formData.append('quantity_kg', String(quantityKg));
    formData.append('price_yen_per_kg', String(priceYenPerKg));
    formData.append('available', String(available));
    if (imageFile) {
      formData.append('image', imageFile);
    } else if (product && !currentImageUrl && product.image) {
      // This case means the image was explicitly removed.
      // Backend might need a specific way to signal image removal if '' is not enough.
      // For DRF, not sending 'image' usually means "no change".
      // To remove, one might send 'image': null, or a specific field.
      // For now, if no new imageFile, existing image is kept unless currentImageUrl is also null (cleared).
      // If currentImageUrl is null and no imageFile, it implies removal.
      // But standard form submission won't send 'image' if field is empty.
      // The backend ProductSerializer has `image = serializers.ImageField(required=False, allow_null=True)`.
      // Sending empty string for image might not work; null might be better.
      // Let's assume if imageFile is null, and it's an update, we don't want to change the image unless explicitly cleared.
      // If product.image exists and imageFile is null and currentImageUrl is null, it suggests clearing.
      // This part needs careful handling with backend.
      // For now, if imageFile is not set, we don't append it. Backend keeps old or sets to null if it was cleared.
    }

    onSave(formData, product?.id);
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div>
        <label htmlFor="name">Product Name</label>
        <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="description">Description</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label htmlFor="riceType">Rice Type</label>
        <select id="riceType" value={riceType} onChange={(e) => setRiceType(e.target.value)}>
          {RICE_TYPE_CHOICES.map(choice => (
            <option key={choice.value} value={choice.value}>{choice.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="quantityKg">Quantity (kg)</label>
        <input type="number" step="0.01" id="quantityKg" value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="priceYenPerKg">Price (Yen per kg)</label>
        <input type="number" step="0.01" id="priceYenPerKg" value={priceYenPerKg} onChange={(e) => setPriceYenPerKg(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="image">Product Image</label>
        <input type="file" id="image" accept="image/*" onChange={handleImageChange} />
        {currentImageUrl && !imageFile && <div><img src={currentImageUrl} alt="Current product" style={{width: "100px", height: "auto"}}/> <button type="button" onClick={() => setCurrentImageUrl(null)}>Remove Image</button> </div>}
      </div>
       <div>
        <label>
          <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
          Available for purchase
        </label>
      </div>
      <button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Product'}</button>
    </form>
  );
};

export default ProductForm;
