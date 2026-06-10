export type ConsultDoctorListDoctor = {
  id: string;
  name: string;
  specialty: string;
  tags: string[];
  price: string;
  rating: string;
  imageSrc: string;
  bookingHref: "/consult/booking/somchai";
  isRecommended: boolean;
};

export type ConsultDoctorListData = {
  doctors: ConsultDoctorListDoctor[];
  activeRecommendation:
    | {
        topic: string;
        specialty: string;
      }
    | null;
  unavailable?: boolean;
};
