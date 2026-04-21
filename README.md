# DocRian: Durian Leaf Disease Detection and Classification System

**DocRian** is an AI-powered mobile-first web application developed by team **Lion Coding**. It leverages advanced Deep Learning to provide farmers with an instant, accurate, and convenient way to diagnose durian leaf diseases directly from their smartphones.

## Features

- **Mobile-First Experience**: Designed for field usability with native camera integration and a responsive interface.
- **AI-Powered Diagnosis**: Utilizes a **CNN (MobileNetV2)** architecture to classify leaf conditions with high precision.
- **Severity Assessment**: Beyond just identifying the disease, DocRian provides confidence levels and severity insights for each scan.
- **Automated History**: All scans are automatically saved to a secure database, allowing users to track disease progression over time.
- **Secure Profile Management**: Personalize your account with custom avatars (including a built-in cropper) and manage your data securely.

## Supported Diagnoses

DocRian is trained to detect several critical durian pathologies:

| Disease | Description |
| :--- | :--- |
| **Healthy Leaf** | Vibrant green leaves with no signs of infection. |
| **Algal Leaf Spot** | Green or orange-red spots with a texture similar to algae. |
| **Colletotrichum** | Distinct black spots or rotting "wounds" on the leaf surface. |
| **Phomopsis** | Spreading brown spots that can compromise leaf health. |
| **Leaf Blight** | Characterized by "burnt" patches on the leaf blades. |
| **Rhizoctonia** | Dry, brittle areas that often spread in circular patterns. |

## Tech Stack

- **Frontend**: [Next.js 15](https://nextjs.org/) (App Router), TypeScript, Vanilla CSS.
- **Backend/Auth**: [Supabase](https://supabase.com/) (PostgreSQL, Authentication, Storage).
- **Deep Learning**: **CNN (MobileNetV2)** for image classification and feature extraction.
- **Icons**: [Lucide React](https://lucide.dev/).
- **Image Processing**: Custom preprocessing pipeline for resizing and normalization.

## Getting Started

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/0-Mini-Peak-1/DocRian.git
   cd DocRian
   ```

2. **Install dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Environment Configuration**:
   Create a `.env.local` file with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Initialization**:
   - Execute the SQL scripts in your Supabase SQL Editor to set up the `profiles`, `scans`, and storage buckets.

5. **Start Development**:
   ```bash
   npm run dev
   ```

## Architecture

DocRian follows a modern cloud-native architecture:
**Mobile App** -> **Image Preprocessing** -> **CNN (MobileNetV2) Inference** -> **Database Storage** -> **User Dashboard**

## Team Lion Coding (Contributors)

- **Aompol Kotsuno** (6600685)
- **Papangkorn Thammasukassant** (6602024)
- **Chawagorn Toomma** (6601398)

---
*Develed for CSC472 Artificial Intelligence. Built in Rnagsit University with ❤️ for the Durian Farming Community.*
