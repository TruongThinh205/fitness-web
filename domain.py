from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


class NguoiDung(ABC):
    def __init__(self, maND: str, hoTen: str, email: str, chieuCaoCm: float, canNangKg: float):
        self._maND = maND
        self.hoTen = hoTen
        self.email = email
        self.chieuCaoCm = float(chieuCaoCm)
        self.canNangKg = float(canNangKg)

    @property
    def maND(self) -> str:
        return self._maND

    def tinhBMI(self) -> float:
        return self.canNangKg / ((self.chieuCaoCm / 100) ** 2)

    @abstractmethod
    def tinhBMR(self) -> float:
        raise NotImplementedError


class HocVien(NguoiDung):
    def __init__(self, maND: str, hoTen: str, email: str, chieuCaoCm: float, canNangKg: float,
                 tuoi: int, laNam: bool, heSoVongDong: float, mucTieu: str):
        super().__init__(maND, hoTen, email, chieuCaoCm, canNangKg)
        if not 1.2 <= float(heSoVongDong) <= 1.725:
            raise ValueError("Hệ số vận động phải nằm trong khoảng 1.2 đến 1.725")
        self.tuoi = int(tuoi)
        self.laNam = bool(laNam)
        self.heSoVongDong = float(heSoVongDong)
        self.mucTieu = mucTieu

    def tinhBMR(self) -> float:
        gender_adjustment = 5 if self.laNam else -161
        return 10 * self.canNangKg + 6.25 * self.chieuCaoCm - 5 * self.tuoi + gender_adjustment

    def tinhTDEE(self) -> float:
        return self.tinhBMR() * self.heSoVongDong


class HuanLuyenVien(NguoiDung):
    def tinhBMR(self) -> float:
        return 10 * self.canNangKg + 6.25 * self.chieuCaoCm - 5 * 30 + 5


class Admin(NguoiDung):
    def tinhBMR(self) -> float:
        return 10 * self.canNangKg + 6.25 * self.chieuCaoCm - 5 * 30 + 5


class Exercise(ABC):
    def __init__(self, name: str, duration: float):
        self.name = name
        self.duration = float(duration)

    @abstractmethod
    def calculateCalories(self) -> float:
        raise NotImplementedError


class CardioExercise(Exercise):
    def __init__(self, name: str, duration: float, distance: float, avgHeartRate: float):
        super().__init__(name, duration)
        self.distance = float(distance)
        self.avgHeartRate = float(avgHeartRate)

    def calculateCalories(self) -> float:
        speed = self.distance / max(self.duration / 60, 0.01)
        return self.duration * (0.25 * self.avgHeartRate + 3.5 * speed)


class StrengthExercise(Exercise):
    def __init__(self, name: str, duration: float, sets: int, reps: int, weightLifted: float):
        super().__init__(name, duration)
        self.sets = int(sets)
        self.reps = int(reps)
        self.weightLifted = float(weightLifted)

    def calculateCalories(self) -> float:
        total_volume = self.sets * self.reps * self.weightLifted
        return self.duration * 3.5 + total_volume * 0.025


@dataclass
class MonAn:
    maMon: Optional[int]
    tenMon: str
    caloPer100g: float
    protein: float
    carb: float
    fat: float

    def tinhCalo(self, gram: float) -> float:
        return self.caloPer100g * float(gram) / 100


@dataclass
class ChiTietBuaAn:
    monAn: MonAn
    khoiLuongGram: float
    buoiAn: str

    @property
    def calo(self) -> float:
        return self.monAn.tinhCalo(self.khoiLuongGram)


@dataclass
class NhatKyDinhDuong:
    maNK: Optional[int]
    hocVien: HocVien
    ngayGhi: str
    chiTiet: list[ChiTietBuaAn] = field(default_factory=list)

    def themBuaAn(self, chiTiet: ChiTietBuaAn) -> None:
        self.chiTiet.append(chiTiet)

    def tinhTongCaloNap(self) -> float:
        return sum(item.calo for item in self.chiTiet)


@dataclass
class ChiTietKeHoach:
    baiTap: dict
    thuTrongTuan: int
    thoiGianPhut: int


@dataclass
class KeHoachTapLuyen:
    maKH: Optional[int]
    hocVienId: str
    huanLuyenVienId: str
    tenKeHoach: str
    chiTiet: list[ChiTietKeHoach] = field(default_factory=list)