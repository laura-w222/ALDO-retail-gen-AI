import React, { useState, Fragment, useEffect } from 'react';
import './App.css';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);
  const [currentBundleIndex, setCurrentBundleIndex] = useState(0);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [showBoxAnimation, setShowBoxAnimation] = useState(false);
  const [animationFrame, setAnimationFrame] = useState(1);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [formData, setFormData] = useState({
    recipient: '',
    outfitImages: [],
    age: 18,
    gender: '',
    occasion: '',
    month: '',
    selectedImages: [],
    budget: ''
  });

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < 9) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleImageSelection = (index) => {
    const newSelection = formData.selectedImages.includes(index)
      ? formData.selectedImages.filter(i => i !== index)
      : [...formData.selectedImages, index];
    updateFormData('selectedImages', newSelection);
  };

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    const newImages = [...formData.outfitImages];
    
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        // Compress image before adding
        compressImage(file, (compressedDataUrl) => {
          newImages.push({
            file: file,
            preview: compressedDataUrl,
            name: file.name
          });
          updateFormData('outfitImages', [...newImages]);
        });
      }
    });
  };

  const compressImage = (file, callback) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Set max dimensions
      const maxWidth = 800;
      const maxHeight = 600;
      
      let { width, height } = img;
      
      // Calculate new dimensions
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality
      callback(compressedDataUrl);
    };
    
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index) => {
    const newImages = formData.outfitImages.filter((_, i) => i !== index);
    updateFormData('outfitImages', newImages);
  };

  const nextBundle = () => {
    if (apiResponse && apiResponse.bundles) {
      setCurrentBundleIndex((prev) => 
        prev < apiResponse.bundles.length - 1 ? prev + 1 : 0
      );
    }
  };

  const prevBundle = () => {
    if (apiResponse && apiResponse.bundles) {
      setCurrentBundleIndex((prev) => 
        prev > 0 ? prev - 1 : apiResponse.bundles.length - 1
      );
    }
  };

  const selectBundle = (bundle) => {
    setSelectedBundle(bundle);
    setShowBoxAnimation(true);
    setAnimationFrame(1);
    
    // Animation sequence
    setTimeout(() => setAnimationFrame(2), 1000); // Frame 2 after 1 second
    setTimeout(() => setAnimationFrame(3), 2500); // Frame 3 after 2.5 seconds
  };

  const submitToAPI = async () => {
    setIsLoading(true);
    setCurrentStep(9); // Go to results page immediately to show loading animation
    try {
      // Parse budget to extract numeric value
      const parseBudget = (budgetStr) => {
        if (!budgetStr) return 0;
        // Remove currency symbols and non-numeric characters, keep only numbers and decimal points
        const numericStr = budgetStr.replace(/[^0-9.]/g, '');
        const parsed = parseFloat(numericStr);
        return isNaN(parsed) ? 0 : parsed;
      };

      // Prepare the payload
      const payload = {
        recipient: formData.recipient,
        images: formData.outfitImages.map(img => img.preview), // Send as array of base64 strings
        age: formData.age,
        gender: formData.gender,
        occasion: formData.occasion,
        month: formData.month,
        selectedImages: formData.selectedImages,
        budget: parseBudget(formData.budget) // Convert to number
      };

      console.log('Sending payload:', { ...payload, images: `[${payload.images.length} images]` });

      const response = await fetch('https://cjrw1dwlx2.execute-api.us-east-1.amazonaws.com/prod/outfit-bundles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API Success Response:', data);
      setApiResponse(data);
      setCurrentBundleIndex(0); // Reset carousel to first bundle
    } catch (error) {
      console.error('Error calling API:', error);
      setApiResponse({ 
        error: `Failed to get gift recommendations: ${error.message}. Please try again.` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="page active">
        <div className="logo">ALDO</div>
        <div className="mascot">🎁</div>
      </div>

      {/* Step 0: Welcome */}
      {currentStep === 0 && (
        <div className="paper-overlay step-0">
          <div className="question">
            So you want to buy a gift?
            <br />
            <br />
            I'm Gifty and let's buy a gift together!
          </div>
          <button className="next-btn" onClick={nextStep}>
            Let's Start!
          </button>
          <img src="/mascot.svg" alt="Gifty Mascot" className="paper-mascot" />
        </div>
      )}

      {/* Step 1: Who is it for? */}
      {currentStep === 1 && (
        <div className="paper-overlay step-1">
          <button className="back-btn" onClick={prevStep}>← Back</button>
          <img src="/who.svg" alt="Who" className="who-icon" />
          <div className="question">Who is it for?</div>
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter name..."
              value={formData.recipient}
              onChange={(e) => updateFormData('recipient', e.target.value)}
            />
          </div>
          <button 
            className="next-btn" 
            onClick={nextStep}
            disabled={!formData.recipient.trim()}
          >
            Next
          </button>
        </div>
      )}

      {/* Step 2: Outfit Image Upload */}
      {currentStep === 2 && (
        <div className="paper-overlay step-2">
          <button className="back-btn" onClick={prevStep}>← Back</button>
          <img src="/take_pics.svg" alt="Take Pictures" className="take-pics-icon" />
          <div className="question">Please add one or more outfit image that best describes the style</div>
          
          <div className="image-upload-section">
            <div className="upload-area">
              <input
                type="file"
                id="outfit-upload"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <label htmlFor="outfit-upload" className="upload-label">
                <div className="upload-icon">📷</div>
                <div className="upload-text">
                  Click to upload outfit images
                  <br />
                  <small>You can select multiple images</small>
                </div>
              </label>
            </div>
            
            {formData.outfitImages.length > 0 && (
              <div className="uploaded-images">
                {formData.outfitImages.map((image, index) => (
                  <div key={index} className="uploaded-image">
                    <img src={image.preview} alt={`Outfit ${index + 1}`} />
                    <button 
                      className="remove-image-btn"
                      onClick={() => removeImage(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <button 
            className="next-btn" 
            onClick={nextStep}
            disabled={formData.outfitImages.length === 0}
          >
            Next
          </button>
        </div>
      )}

      {/* Step 3: Age */}
      {currentStep === 3 && (
        <div className="paper-overlay step-3">
          <button className="back-btn" onClick={prevStep}>← Back</button>
          <div className="question">Tell me about them?</div>
          <div className="age-slider">
            <label>Age:</label>
            <input
              type="range"
              min="1"
              max="100"
              value={formData.age}
              onChange={(e) => updateFormData('age', parseInt(e.target.value))}
            />
            <div className="age-value">{formData.age}</div>
          </div>
          <button className="next-btn" onClick={nextStep}>
            Next
          </button>
        </div>
      )}

      {/* Step 4: Gender */}
      {currentStep === 4 && (
        <div className="paper-overlay step-4">
          <button className="back-btn" onClick={prevStep}>← Back</button>
          <div className="question">Tell me about them?</div>
          <div className="options">
            <button
              className={`option-btn ${formData.gender === 'M' ? 'selected' : ''}`}
              onClick={() => updateFormData('gender', 'M')}
            >
              M
            </button>
            <button
              className={`option-btn ${formData.gender === 'F' ? 'selected' : ''}`}
              onClick={() => updateFormData('gender', 'F')}
            >
              F
            </button>
            <button
              className={`option-btn ${formData.gender === 'Other' ? 'selected' : ''}`}
              onClick={() => updateFormData('gender', 'Other')}
            >
              Other
            </button>
            <button
              className={`option-btn ${formData.gender === 'Prefer not to say' ? 'selected' : ''}`}
              onClick={() => updateFormData('gender', 'Prefer not to say')}
            >
              Prefer not to say
            </button>
          </div>
          <button 
            className="next-btn" 
            onClick={nextStep}
            disabled={!formData.gender}
          >
            Next
          </button>
        </div>
      )}

      {/* Step 5: When is the gift for? */}
      {currentStep === 5 && (
        <div className="paper-overlay step-5">
          <button className="back-btn" onClick={prevStep}>← Back</button>
          <div className="question">Tell me about them?</div>
          <div className="input-group">
            <label>When is the gift for?</label>
            <MonthDropdown 
              value={formData.month}
              onChange={(month) => updateFormData('month', month)}
            />
          </div>
          <button 
            className="next-btn" 
            onClick={nextStep}
            disabled={!formData.month}
          >
            Next
          </button>
        </div>
      )}

      {/* Step 6: Occasion */}
      {currentStep === 6 && (
        <div className="paper-overlay step-6">
          <button className="back-btn" onClick={prevStep}>← Back</button>
          <img src="/occasion.svg" alt="Occasion" className="occasion-icon" />
          <div className="question">Tell me about them?</div>
          <div className="input-group">
            <label>Occasion:</label>
            <input
              type="text"
              placeholder="Birthday, Anniversary, etc..."
              value={formData.occasion}
              onChange={(e) => updateFormData('occasion', e.target.value)}
            />
          </div>
          <button 
            className="next-btn" 
            onClick={nextStep}
            disabled={!formData.occasion.trim()}
          >
            Next
          </button>
        </div>
      )}

      {/* Step 7: Budget */}
      {currentStep === 7 && (
        <div className="paper-overlay step-7">
          <button className="back-btn" onClick={prevStep}>← Back</button>
          <div className="question">What's your budget?</div>
          <div className="input-group">
            <label>Enter budget:</label>
            <input
              type="text"
              placeholder="$50, $100, etc..."
              value={formData.budget}
              onChange={(e) => updateFormData('budget', e.target.value)}
            />
          </div>
          <button 
            className="next-btn" 
            onClick={nextStep}
            disabled={!formData.budget.trim()}
          >
            Next
          </button>
        </div>
      )}

      {/* Step 8: Ready to find gifts */}
      {currentStep === 8 && (
        <div className="paper-overlay step-8">
          <button className="back-btn" onClick={prevStep}>← Back</button>
          <div className="final-message">
            <h2>It seems like we are ready.</h2>
            <p>Let's go find a gift!</p>
            <button 
              className="next-btn find-gifts-btn" 
              onClick={submitToAPI}
              disabled={isLoading}
            >
              {isLoading ? 'Finding Gifts...' : 'Find Gifts!'}
            </button>
          </div>
        </div>
      )}

      {/* Step 9: Results from API */}
      {currentStep === 9 && (
        <div className="paper-overlay step-9">
          <div className="results-page">
            {isLoading ? (
              <WalkingLoader recipient={formData.recipient} />
            ) : apiResponse ? (
              <div className="gift-results">
                <h2>Perfect Gifts for {formData.recipient}!</h2>
                {apiResponse.error ? (
                  <div className="error-message">
                    <p>{apiResponse.error}</p>
                    <button className="next-btn" onClick={() => setCurrentStep(7)}>
                      Try Again
                    </button>
                  </div>
                ) : (
                  <div className="bundle-carousel-container">
                    <div className="bundle-explanation">
                      <h3>🎯 AI-Curated Gift Bundles</h3>
                      <p>Our AI analyzed your style preferences and created these perfect shoe & handbag combinations for {formData.recipient}. Each bundle is carefully matched for style, occasion, and budget.</p>
                    </div>

                    {apiResponse.bundles && apiResponse.bundles.length > 0 && (
                      <div className="bundle-carousel">
                        <div className="carousel-header">
                          <h3>Bundle {currentBundleIndex + 1} of {apiResponse.bundles.length}</h3>
                          <div className="carousel-dots">
                            {apiResponse.bundles.map((_, index) => (
                              <button
                                key={index}
                                className={`dot ${index === currentBundleIndex ? 'active' : ''}`}
                                onClick={() => setCurrentBundleIndex(index)}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="carousel-content">
                          <button 
                            className="carousel-btn prev-btn" 
                            onClick={prevBundle}
                            disabled={apiResponse.bundles.length <= 1}
                          >
                            ‹
                          </button>

                          <div className="bundle-display">
                            {(() => {
                              const bundle = apiResponse.bundles[currentBundleIndex];
                              return (
                                <div className="bundle-card-horizontal">
                                  <div className="bundle-header">
                                    <h3>{bundle.bundle_name || `Bundle ${bundle.bundle_number}`}</h3>
                                    <div className="bundle-meta">
                                      <span className="bundle-type">{bundle.bundle_type}</span>
                                      <span className="match-score">Match: {bundle.match_score}/10</span>
                                    </div>
                                  </div>

                                  <div className="bundle-feedback">
                                    <button className="feedback-btn thumbs-up" title="I like this bundle">
                                      👍
                                    </button>
                                    <button className="feedback-btn thumbs-down" title="Not for me">
                                      👎
                                    </button>
                                  </div>

                                  <div className="bundle-items-horizontal">
                                    {bundle.items && bundle.items.map((item, itemIndex) => {
                                      const getCategoryIcon = (category) => {
                                        switch(category) {
                                          case 'shoes': return '👠';
                                          case 'handbag': return '👜';
                                          case 'clothing': return '👔';
                                          default: return '🎁';
                                        }
                                      };

                                      const getCategoryLabel = (category) => {
                                        switch(category) {
                                          case 'shoes': return 'Shoes';
                                          case 'handbag': return 'Handbag';
                                          case 'clothing': return 'Clothing';
                                          default: return 'Item';
                                        }
                                      };

                                      return (
                                        <Fragment key={itemIndex}>
                                          <div className="bundle-item-horizontal">
                                            <div className="item-header">
                                              <h4>{getCategoryIcon(item.category)} {getCategoryLabel(item.category)}</h4>
                                            </div>
                                            {item.image_url && (
                                              <img src={item.image_url} alt={item.product_name} className="item-image-large" />
                                            )}
                                            <div className="item-details">
                                              <p className="item-name">{item.product_name}</p>
                                              <p className="item-price">${item.price}</p>
                                              {item.product_url && (
                                                <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="item-link">
                                                  View {getCategoryLabel(item.category)}
                                                </a>
                                              )}
                                              {item.reason && (
                                                <div className="item-reason">
                                                  <p><strong>Why this {item.category}:</strong> {item.reason}</p>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          {itemIndex < bundle.items.length - 1 && (
                                            <div className="bundle-connector">
                                              <div className="connector-line"></div>
                                              <div className="plus-icon">+</div>
                                              <div className="connector-line"></div>
                                            </div>
                                          )}
                                        </Fragment>
                                      );
                                    })}
                                  </div>

                                  {bundle.total_cost && (
                                    <div className="bundle-total-horizontal">
                                      <div className="total-label">Bundle Total</div>
                                      <div className="total-price">${bundle.total_cost}</div>
                                    </div>
                                  )}

                                  {bundle.styling_note && (
                                    <div className="bundle-note">
                                      <h5>✨ Styling Note</h5>
                                      <p>{bundle.styling_note}</p>
                                    </div>
                                  )}

                                  <div className="bundle-actions">
                                    <button 
                                      className="select-bundle-btn"
                                      onClick={() => selectBundle(bundle)}
                                    >
                                      Select This Bundle 🎁
                                    </button>
                                    <button 
                                      className="feedback-link-btn"
                                      onClick={() => setShowFeedbackForm(true)}
                                    >
                                      📝 Share your feedback
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          <button 
                            className="carousel-btn next-btn" 
                            onClick={nextBundle}
                            disabled={apiResponse.bundles.length <= 1}
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {apiResponse.context && (
                      <div className="context-info">
                        <h4>📋 Your Preferences</h4>
                        <div className="context-grid">
                          <div className="context-item">
                            <span className="context-label">Recipient:</span>
                            <span className="context-value">{formData.recipient}</span>
                          </div>
                          <div className="context-item">
                            <span className="context-label">Age:</span>
                            <span className="context-value">{apiResponse.context.age}</span>
                          </div>
                          <div className="context-item">
                            <span className="context-label">Gender:</span>
                            <span className="context-value">{apiResponse.context.gender}</span>
                          </div>
                          <div className="context-item">
                            <span className="context-label">Occasion:</span>
                            <span className="context-value">{apiResponse.context.occasion}</span>
                          </div>
                          <div className="context-item">
                            <span className="context-label">Budget:</span>
                            <span className="context-value">${apiResponse.context.budget}</span>
                          </div>
                          <div className="context-item">
                            <span className="context-label">Outfits Found:</span>
                            <span className="context-value">{apiResponse.outfits_count}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <button className="next-btn" onClick={() => {
                  setCurrentStep(0);
                  setFormData({
                    recipient: '',
                    outfitImages: [],
                    age: 18,
                    gender: '',
                    occasion: '',
                    month: '',
                    selectedImages: [],
                    budget: ''
                  });
                  setApiResponse(null);
                  setSelectedBundle(null);
                  setShowBoxAnimation(false);
                  setAnimationFrame(1);
                }}>
                  Start Over
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Box Animation Overlay */}
      {showBoxAnimation && selectedBundle && (
        <BoxAnimation 
          bundle={selectedBundle}
          animationFrame={animationFrame}
          outfitImages={formData.outfitImages}
          onClose={() => {
            setShowBoxAnimation(false);
            setSelectedBundle(null);
            setAnimationFrame(1);
          }}
        />
      )}

      {/* Feedback Form Overlay */}
      {showFeedbackForm && (
        <FeedbackForm onClose={() => setShowFeedbackForm(false)} />
      )}
    </div>
  );
}

function FeedbackForm({ onClose }) {
  const [feedback, setFeedback] = useState({
    q1_satisfaction: '',
    q2_relevance: '',
    q3_ease: '',
    q4_appeal: '',
    q5_understanding: '',
    q6_suggestions: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Feedback submitted:', feedback);
    // Here you can add API call to save feedback
    alert('Thank you for your feedback!');
    onClose();
  };

  const updateFeedback = (field, value) => {
    setFeedback(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="feedback-overlay">
      <div className="feedback-container">
        <button className="close-feedback-btn" onClick={onClose}>×</button>
        <h2>We'd love your feedback!</h2>
        <p className="feedback-subtitle">Help us improve your gift-finding experience</p>
        
        <form onSubmit={handleSubmit} className="feedback-form">
          {/* Q1: Overall Experience */}
          <div className="form-group">
            <label className="question-label">Q1. Overall Experience</label>
            <p className="question-text">How satisfied are you with your overall experience using the AI Bundle Assistant?</p>
            <div className="radio-group">
              {['Very Satisfied', 'Satisfied', 'Neutral', 'Unsatisfied', 'Very Unsatisfied'].map(option => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name="q1"
                    value={option}
                    checked={feedback.q1_satisfaction === option}
                    onChange={(e) => updateFeedback('q1_satisfaction', e.target.value)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Q2: Bundle Relevance */}
          <div className="form-group">
            <label className="question-label">Q2. Bundle Relevance</label>
            <p className="question-text">How well did the recommended bundle match your preferences?</p>
            <div className="radio-group">
              {['Perfectly matched', 'Mostly matched', 'Somewhat matched', 'Barely matched', 'Not matched at all'].map(option => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name="q2"
                    value={option}
                    checked={feedback.q2_relevance === option}
                    onChange={(e) => updateFeedback('q2_relevance', e.target.value)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Q3: Ease of Use */}
          <div className="form-group">
            <label className="question-label">Q3. Ease of Use</label>
            <p className="question-text">How easy was it to use the AI Assistant to build or select your bundle?</p>
            <div className="radio-group">
              {['Very Easy', 'Easy', 'Neutral', 'Difficult', 'Very Difficult'].map(option => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name="q3"
                    value={option}
                    checked={feedback.q3_ease === option}
                    onChange={(e) => updateFeedback('q3_ease', e.target.value)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Q4: Bundle Appeal */}
          <div className="form-group">
            <label className="question-label">Q4. Bundle Appeal</label>
            <p className="question-text">How appealing were the items and overall presentation of the bundle?</p>
            <div className="radio-group">
              {['Extremely appealing', 'Quite appealing', 'Somewhat appealing', 'Slightly appealing', 'Not appealing'].map(option => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name="q4"
                    value={option}
                    checked={feedback.q4_appeal === option}
                    onChange={(e) => updateFeedback('q4_appeal', e.target.value)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Q5: AI Understanding */}
          <div className="form-group">
            <label className="question-label">Q5. AI Understanding</label>
            <p className="question-text">Do you feel the AI understood your preferences accurately?</p>
            <div className="radio-group">
              {['Yes, completely', 'Mostly', 'Partially', 'Not really', 'Not at all'].map(option => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name="q5"
                    value={option}
                    checked={feedback.q5_understanding === option}
                    onChange={(e) => updateFeedback('q5_understanding', e.target.value)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Q6: Suggestions */}
          <div className="form-group">
            <label className="question-label">Q6. Suggestions for Improvement</label>
            <p className="question-text">What would make your experience better?</p>
            <textarea
              value={feedback.q6_suggestions}
              onChange={(e) => updateFeedback('q6_suggestions', e.target.value)}
              placeholder="Share your thoughts..."
              rows="4"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-feedback-btn">
              Submit Feedback
            </button>
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BoxAnimation({ bundle, animationFrame, outfitImages, onClose }) {
  return (
    <div className="box-animation-overlay">
      <div className="box-animation-container">
        <button className="close-animation-btn" onClick={onClose}>×</button>
        
        {/* Frame 1: Closed Box */}
        {animationFrame === 1 && (
          <div className="animation-frame frame-1">
            <div className="svg-frame-container">
              <img src="/frame1.svg" alt="Closed Gift Box" className="frame-svg" />
            </div>
            <h3>Preparing your perfect gift bundle...</h3>
          </div>
        )}

        {/* Frame 2: Opening Box with Effects */}
        {animationFrame === 2 && (
          <div className="animation-frame frame-2">
            <div className="svg-frame-container">
              <img src="/frame2.svg" alt="Opening Gift Box" className="frame-svg" />
              
              {/* Aesthetic Effects overlaid on the SVG */}
              <div className="aesthetic-effects-overlay">
                <span className="effect effect-1">˚.・</span>
                <span className="effect effect-2">⊹ ࣪ ˖</span>
                <span className="effect effect-3">☆⋆｡𖦹°‧★</span>
                <span className="effect effect-4">˙⋆✮</span>
                <span className="effect effect-5">⋆˚⟡˖ ࣪</span>
                <span className="effect effect-6">˚.・</span>
              </div>
            </div>
            <h3>Opening your gift bundle...</h3>
          </div>
        )}

        {/* Frame 3: Cards sliding up behind frame 2 */}
        {animationFrame === 3 && (
          <div className="animation-frame frame-3">
            <div className="svg-frame-container">
              {/* Cards sliding up behind the box */}
              <div className="cards-sliding-container">
                {/* Reference Card */}
                {outfitImages.length > 0 && (
                  <div className="sliding-card reference-card">
                    <img src={outfitImages[0].preview} alt="Style Reference" />
                    <div className="card-label">Reference</div>
                  </div>
                )}
                
                {/* Bundle Item Cards */}
                {bundle.items && bundle.items.map((item, index) => (
                  <div key={index} className={`sliding-card card-${index + 1}`}>
                    {item.image_url && (
                      <img src={item.image_url} alt={item.product_name} />
                    )}
                    <div className="card-label">{item.product_name}</div>
                    <div className="card-price">${item.price}</div>
                  </div>
                ))}
              </div>
              
              {/* Keep using frame2.svg for the opened box */}
              <img src="/frame2.svg" alt="Opened Gift Box" className="frame-svg frame-sme-svg-top" />
            </div>
            
            <div className="bundle-summary">
              <h3>🎉 Your Perfect Gift Bundle!</h3>
              <p><strong>{bundle.bundle_name}</strong></p>
              <p>Total: <strong>${bundle.total_cost}</strong></p>
              <p>{bundle.styling_note}</p>
              
              <div className="final-actions">
                <button className="purchase-btn">Purchase Bundle</button>
                <button className="share-btn">Share Bundle</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WalkingLoader({ recipient }) {
  const [walkFrame, setWalkFrame] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setWalkFrame(prev => (prev % 3) + 1);
    }, 300); // Change frame every 300ms

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="walking-loader">
      <img 
        src={`/walk${walkFrame}.svg`} 
        alt="Walking" 
        className="walk-animation" 
      />
      <p>Finding the perfect gifts for {recipient}...</p>
    </div>
  );
}

function MonthDropdown({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="dropdown">
      <button 
        className="dropdown-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value || 'Month'}
      </button>
      {isOpen && (
        <div className="dropdown-content">
          {months.map(month => (
            <div
              key={month}
              className="dropdown-item"
              onClick={() => {
                onChange(month);
                setIsOpen(false);
              }}
            >
              {month}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;